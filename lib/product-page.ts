import type { Product } from "@/types";

export const PRODUCTS_PER_PAGE = 10;

export interface ProductPage {
  products: Product[];
  nextOffset: number | null;
}
