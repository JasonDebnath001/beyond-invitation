import type { ProductCategory } from "@/types";
import type { CatalogProduct } from "@/lib/catalog";

export const COLLECTION_PAGE_SIZE = 24;
export const CATALOG_SORTS = ["featured", "price-asc", "price-desc", "discount"] as const;
export const CATALOG_PRICES = ["all", "under-100", "100-300", "300-1000", "above-1000"] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];
export type CatalogPrice = typeof CATALOG_PRICES[number];
export interface CatalogScope { category?: ProductCategory; subjects?: string[] }
export interface CatalogBrowseOptions extends CatalogScope { offset?: number; sort?: CatalogSort; price?: CatalogPrice }
export interface CatalogBrowsePage { products: CatalogProduct[]; nextOffset: number | null; total: number }
export const emptyCatalogPage = (): CatalogBrowsePage => ({ products: [], nextOffset: null, total: 0 });

export function catalogBrowseQuery(scope: CatalogScope, price: CatalogPrice = "all", sort: CatalogSort = "featured") {
  const params = new URLSearchParams({ mode: "catalog", price, sort });
  if (scope.category) params.set("category", scope.category);
  if (scope.subjects?.length) params.set("subjects", scope.subjects.join(","));
  return params.toString();
}
