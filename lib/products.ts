import productsData from "@/data/products.json";
import categoriesData from "@/data/categories.json";
import type { Product, Category, ProductCategory } from "@/types";

/*
 * DATA ACCESS LAYER
 * -----------------
 * Every component fetches data through these functions — never by importing
 * the JSON files directly. This is the single place to swap when moving to
 * ERPNext: replace the function bodies with `fetch()` calls to the ERPNext
 * REST API (see lib/erpnext.ts) and nothing else in the app needs to change.
 *
 * The functions are async on purpose, so the swap to a real API is seamless.
 */

const products = productsData as Product[];
const categories = categoriesData as Category[];

/** Return every product. */
export async function getAllProducts(): Promise<Product[]> {
  return products;
}

/** Find a single product by its slug. Returns null if not found. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return products.find((p) => p.slug === slug) ?? null;
}

/** Products flagged for the homepage Sale section. */
export async function getSaleProducts(): Promise<Product[]> {
  return products.filter((p) => p.onSale);
}

/** Products flagged for the homepage Premium section. */
export async function getPremiumProducts(): Promise<Product[]> {
  return products.filter((p) => p.isPremium);
}

/** All products belonging to one category. */
export async function getProductsByCategory(
  category: ProductCategory,
): Promise<Product[]> {
  return products.filter((p) => p.category === category);
}

/** Related products from the same category, excluding the current one. */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  return products
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, limit);
}

/** Every category. */
export async function getAllCategories(): Promise<Category[]> {
  return categories;
}

/** Find a single category by slug. */
export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return categories.find((c) => c.slug === slug) ?? null;
}

/** All product slugs — used by generateStaticParams for static generation. */
export async function getAllProductSlugs(): Promise<string[]> {
  return products.map((p) => p.slug);
}

/**
 * Search products by name, description and category. Case-insensitive.
 * Every search term must be present (AND match), so "blue card" only
 * matches products containing both words.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/);

  return products.filter((p) => {
    const haystack =
      `${p.name} ${p.description} ${p.category}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}