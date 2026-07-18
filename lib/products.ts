import productsData from "@/data/products.json";
import categoriesData from "@/data/categories.json";

import type {
  Product,
  Category,
  ProductCategory,
} from "@/types";

import {
  fetchErpProducts,
  fetchErpProductsBase,
  type ErpProduct,
} from "@/lib/erpnext";
import { applyResellerPricingToProducts } from "@/lib/reseller";

const localProducts = productsData as Product[];
const categories = categoriesData as Category[];

/*
 * Small in-memory cache for navbar search.
 *
 * The navbar sends a request after the user stops typing.
 * Without this cache, every keystroke could trigger another
 * complete ERPNext product request.
 */
let cachedErpProducts: ErpProduct[] | null = null;
let cacheExpiresAt = 0;

const SEARCH_CACHE_DURATION = 60 * 1000;

async function getErpProductsForSearch(): Promise<ErpProduct[]> {
  const now = Date.now();

  if (cachedErpProducts && now < cacheExpiresAt) {
    return cachedErpProducts;
  }

  const products = await fetchErpProductsBase();

  cachedErpProducts = products;
  cacheExpiresAt = now + SEARCH_CACHE_DURATION;

  return products;
}

/*
 * Remove HTML, repeated spaces and letter accents so that
 * product-title searching is more reliable.
 */
function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "and")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type SearchableProduct = Product &
  Partial<{
    itemCode: string;
    itemGroup: string;
    erpName: string;
    subject: string;
  }>;

/**
 * Return every local product.
 *
 * This remains unchanged because other older sections of the
 * website may still depend on the local product fixtures.
 */
export async function getAllProducts(): Promise<Product[]> {
  return localProducts;
}

/**
 * Return the full product catalog from local fixtures and ERPNext.
 *
 * ERPNext failures are treated as a non-blocking fallback so sitemap and
 * other catalog-driven routes still render with the local catalog.
 */
export async function getCatalogProducts(): Promise<Product[]> {
  const catalogProducts = [...localProducts];

  try {
    const erpProducts = await fetchErpProducts();

    const merged = [...catalogProducts, ...erpProducts];
    const seen = new Set<string>();

    return merged.filter((product) => {
      const key = product.slug?.trim().toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error("Failed to load ERPNext products for catalog", error);
    return catalogProducts;
  }
}

/**
 * Find a local product using its slug.
 */
export async function getProductBySlug(
  slug: string,
): Promise<Product | null> {
  return (
    localProducts.find((product) => product.slug === slug) ??
    null
  );
}

/**
 * Products flagged for the homepage Sale section.
 */
export async function getSaleProducts(): Promise<Product[]> {
  return localProducts.filter((product) => product.onSale);
}

/**
 * Products flagged for the homepage Premium section.
 */
export async function getPremiumProducts(): Promise<Product[]> {
  return localProducts.filter(
    (product) => product.isPremium,
  );
}

/**
 * Local products belonging to one category.
 */
export async function getProductsByCategory(
  category: ProductCategory,
): Promise<Product[]> {
  return localProducts.filter(
    (product) => product.category === category,
  );
}

/**
 * Related local products from the same category.
 */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  return localProducts
    .filter(
      (candidate) =>
        candidate.category === product.category &&
        candidate.slug !== product.slug,
    )
    .slice(0, limit);
}

/**
 * Return every category.
 */
export async function getAllCategories(): Promise<Category[]> {
  return categories;
}

/**
 * Find a category by slug.
 */
export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return (
    categories.find((category) => category.slug === slug) ??
    null
  );
}

/**
 * Return all local product slugs.
 */
export async function getAllProductSlugs(): Promise<string[]> {
  return localProducts.map((product) => product.slug);
}

/**
 * Search live ERPNext products.
 *
 * Searchable fields:
 * - Product title
 * - Item code
 * - ERP document name
 * - Description
 * - Category
 * - ERP item group
 * - Subject
 * - Material
 * - Customisation
 * - Includes
 * - Product slug
 */
export async function searchProducts(
  query: string,
): Promise<Product[]> {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery
    .split(" ")
    .filter(Boolean);

  let searchableProducts: SearchableProduct[];

  try {
    /*
     * Search the products currently displayed from ERPNext.
     *
     * fetchErpProducts() also loads the gallery images, so cards
     * appearing on the search-results page continue using the same
     * main image as the product gallery.
     */
    searchableProducts =
      await getErpProductsForSearch();
  } catch (error) {
    /*
     * Local products are only a fallback so that search does not
     * completely crash when ERPNext is temporarily unavailable.
     */
    console.error(
      "ERPNext search failed. Using local products as fallback:",
      error,
    );

    searchableProducts = localProducts;
  }

  const matchedProducts = searchableProducts
    .map((product, originalIndex) => {
      const title = normalizeSearchText(product.name);

      const itemCode = normalizeSearchText(
        product.itemCode,
      );

      const erpName = normalizeSearchText(
        product.erpName,
      );

      const subject = normalizeSearchText(
        product.subject,
      );

      const itemGroup = normalizeSearchText(
        product.itemGroup,
      );

      const haystack = [
        title,
        normalizeSearchText(product.slug),
        normalizeSearchText(product.description),
        normalizeSearchText(product.category),
        normalizeSearchText(product.customisation),
        normalizeSearchText(product.material),
        normalizeSearchText(product.includes),
        itemCode,
        erpName,
        subject,
        itemGroup,
      ]
        .filter(Boolean)
        .join(" ");

      /*
       * Every entered word must be present somewhere.
       *
       * For example:
       * "floral bride card"
       * must contain floral, bride and card.
       */
      const matches = terms.every((term) =>
        haystack.includes(term),
      );

      if (!matches) {
        return null;
      }

      /*
       * Rank title matches above description/category matches.
       */
      let score = 0;

      if (title === normalizedQuery) {
        score += 1000;
      } else if (title.startsWith(normalizedQuery)) {
        score += 700;
      } else if (title.includes(normalizedQuery)) {
        score += 500;
      }

      if (itemCode === normalizedQuery) {
        score += 450;
      } else if (itemCode.includes(normalizedQuery)) {
        score += 250;
      }

      if (erpName === normalizedQuery) {
        score += 400;
      } else if (erpName.includes(normalizedQuery)) {
        score += 200;
      }

      for (const term of terms) {
        if (title.startsWith(term)) {
          score += 100;
        } else if (title.includes(term)) {
          score += 60;
        }

        if (itemCode.includes(term)) {
          score += 30;
        }

        if (subject.includes(term)) {
          score += 20;
        }

        if (itemGroup.includes(term)) {
          score += 10;
        }
      }

      return {
        product,
        score,
        originalIndex,
      };
    })
    .filter(
      (
        result,
      ): result is {
        product: SearchableProduct;
        score: number;
        originalIndex: number;
      } => result !== null,
    );

  matchedProducts.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.originalIndex - b.originalIndex;
  });

  return await applyResellerPricingToProducts(
    matchedProducts.map(({ product }) => product),
  );
}