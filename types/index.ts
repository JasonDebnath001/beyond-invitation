export interface Product {
  /** Unique URL-friendly identifier, e.g. "white-padded-floral-card" */
  slug: string;

  /** Display name shown on cards and detail page */
  name: string;

  /** Current selling price in INR */
  price: number;

  /** Original MRP in INR (for showing the strikethrough) */
  mrp: number;

  /** Image file names located in /public/products/ or absolute ERPNext image URLs */
  images: string[];

  /** Short emoji fallback shown when an image is missing */
  emoji: string;

  /** Category slug — links product to a collection */
  category: ProductCategory;

  /** Optional badge text, e.g. "New", "Bestseller" */
  badge?: string;

  /** Longer description shown on the product detail page */
  description: string;

  /** ERPNext/custom product detail fields */
  customisation?: string;
  material?: string;
  includes?: string;

  /** Whether the product appears in the homepage "Sale" section */
  onSale?: boolean;

  /** Whether the product appears in the homepage "Premium" section */
  isPremium?: boolean;
}

export type ProductCategory =
  | "wedding"
  | "housewarming"
  | "thread-ceremony"
  | "naming-ceremony"
  | "birthday"
  | "baby-shower"
  | "luxe";

export interface Category {
  slug: ProductCategory;
  name: string;
  emoji: string;
  description: string;
}

/** Helper: discount percentage derived from price + mrp */
export function discountPercent(product: Pick<Product, "price" | "mrp">): number {
  if (product.mrp <= 0 || product.mrp <= product.price) return 0;
  return Math.round(((product.mrp - product.price) / product.mrp) * 100);
}