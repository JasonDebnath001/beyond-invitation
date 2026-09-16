import categoriesData from "@/data/categories.json";
import type { Product, Category, ProductCategory } from "@/types";
import {
  fetchErpProducts,
  fetchErpProductsBase,
  fetchErpProductsByCategory,
  fetchErpProductBySlug,
  type CatalogProduct,
} from "@/lib/catalog";
import { applyResellerPricingToProducts } from "@/lib/reseller";

const categories = categoriesData as Category[];

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

type SearchableProduct = CatalogProduct;

export async function getAllProducts(): Promise<Product[]> {
  return fetchErpProducts();
}

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  return fetchErpProducts();
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return fetchErpProductBySlug(slug);
}

export async function getSaleProducts(): Promise<Product[]> {
  return (await fetchErpProducts()).filter((product) => product.onSale);
}

export async function getPremiumProducts(): Promise<Product[]> {
  return (await fetchErpProducts()).filter((product) => product.isPremium);
}

export async function getProductsByCategory(category: ProductCategory): Promise<Product[]> {
  return fetchErpProductsByCategory(category);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return (await fetchErpProductsByCategory(product.category))
    .filter((candidate) => candidate.slug !== product.slug).slice(0, limit);
}

export async function getAllCategories(): Promise<Category[]> {
  return categories;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getAllProductSlugs(): Promise<string[]> {
  return (await fetchErpProductsBase()).map((product) => product.slug);
}

/** Search the cached public catalogue, retaining the existing field scores. */
export async function searchProducts(query: string): Promise<Product[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const searchableProducts: SearchableProduct[] = await fetchErpProductsBase();

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