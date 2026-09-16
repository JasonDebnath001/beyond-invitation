export interface Product {
  /** Unique URL-friendly identifier, e.g. "white-padded-floral-card" */
  slug: string;

  /** Display name shown on cards and detail page */
  name: string;

  /** Current selling price in INR */
  price: number;

  /** Original price in INR, from the catalogue when available */
  mrp: number;

  /** Image file names located in /public/products/ or absolute catalogue image URLs */
  images: string[];

  /** Video URLs from the catalogue */
  videos?: string[];

  /** Short emoji fallback shown when an image is missing */
  emoji: string;

  /** Category slug — links product to a collection */
  category: ProductCategory;

  /** Optional badge text, e.g. "New", "Bestseller" */
  badge?: string;

  /** Longer description shown on the product detail page */
  description: string;

  /** Optional product detail fields */
  customisation?: string;
  material?: string;
  includes?: string;

  /** Physical package measurements: millimetres for lengths, grams for weight */
  dimensions?: ProductDimensions;

  /** Whether the product appears in the homepage "Sale" section */
  onSale?: boolean;

  /** Whether the product appears in the homepage "Premium" section */
  isPremium?: boolean;
  itemCode?: string;
  itemGroup?: string;
}

export interface ProductDimensions {
  height?: number;
  width?: number;
  weight?: number;
  depth?: number;
  heightInsideCard?: number;
  widthInsideCard?: number;
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
export function discountPercent(
  product: Pick<Product, "price" | "mrp">,
): number {
  if (
    !Number.isFinite(product.price) ||
    !Number.isFinite(product.mrp) ||
    product.price <= 0 ||
    product.mrp <= product.price
  ) return 0;

  return Math.round(((product.mrp - product.price) / product.mrp) * 100);
}
