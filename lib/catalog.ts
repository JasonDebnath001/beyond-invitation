import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import type { Product, ProductCategory } from "@/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  applyResellerPricingToProducts,
  applyResellerPricingToProduct,
} from "@/lib/reseller";

export type CatalogProduct = Product & {
  itemCode: string;
  itemGroup: string;
  erpName: string;
  subject: string;
  tags: string[];
  stockStatus: string;
  minOrderQty: number | null;
  orderMultiple: number | null;
  gstPct: number | null;
  hasPrice: boolean;
  updatedAt: string;
};

/** Compatibility with the existing page and checkout imports. */
export type ErpProduct = CatalogProduct;

type NullableNumber = number | string | null;

/** The public view is the only database relation the storefront reads. */
export interface WebProductRow {
  id: string;
  item_code: string;
  design_no: string;
  slug: string;
  name: string;
  description: string | null;
  price: NullableNumber;
  mrp: NullableNumber;
  gst_pct: NullableNumber;
  image_url: string | null;
  thumb_url: string | null;
  images: unknown;
  videos: unknown;
  subject: string | null;
  tags: string[] | null;
  badge: string | null;
  stock_status: string | null;
  min_order_qty: NullableNumber;
  order_multiple: NullableNumber;
  group_name: string | null;
  width_mm: NullableNumber;
  length_mm: NullableNumber;
  height_mm: NullableNumber;
  weight_g: NullableNumber;
  updated_at: string;
}

function numberOrNull(value: NullableNumber): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mediaList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim() !== "",
        )
        .map((value) => value.trim()),
    ),
  );
}

function photoOrder(src: string): number {
  let filename = src.split(/[?#]/)[0].split("/").pop() ?? "";
  try {
    filename = decodeURIComponent(filename);
  } catch {
    // Keep the original filename when URL encoding is malformed.
  }
  const match = filename.match(/_(\d+)\.[^.]+$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeCategory(subject?: string | null): ProductCategory {
  const value = (subject ?? "").toLowerCase();
  if (value.includes("luxe") || value.includes("luxury")) return "luxe";
  if (value.includes("house")) return "housewarming";
  if (value.includes("thread")) return "thread-ceremony";
  if (value.includes("naming")) return "naming-ceremony";
  if (value.includes("birthday")) return "birthday";
  if (value.includes("baby")) return "baby-shower";
  return "wedding";
}

export const WEDDING_CARD_SUBJECTS = [
  "Wedding Card",
  "Hindu Wedding Card",
  "Muslim Wedding Card",
  "Christian Wedding Card",
];

export const NON_WEDDING_SUBJECTS = [
  "Shagun Envelopes",
  "Wedding Box",
  "Rakhi",
];

export function isWeddingCardProduct(
  product: Pick<CatalogProduct, "subject">,
): boolean {
  const subject = product.subject.trim().toLowerCase();
  return !NON_WEDDING_SUBJECTS.some((value) => value.toLowerCase() === subject);
}

export function mapCatalogRowToProduct(row: WebProductRow): CatalogProduct {
  const price = numberOrNull(row.price) ?? 0;
  const tags = mediaList(row.tags);

  return {
    slug: row.slug,
    name: row.name,
    price,
    mrp: numberOrNull(row.mrp) ?? 0,
    // Filename positions define gallery order and the main image everywhere.
    // Unnumbered images follow numbered ones, retaining their original order.
    images: mediaList([row.image_url, ...mediaList(row.images)]).sort(
      (a, b) => photoOrder(a) - photoOrder(b),
    ),
    videos: mediaList(row.videos),
    emoji: "",
    category: normalizeCategory(row.subject),
    badge: row.badge || tags[0],
    description: DOMPurify.sanitize(row.description ?? ""),
    dimensions: {
      height: numberOrNull(row.height_mm) ?? undefined,
      width: numberOrNull(row.width_mm) ?? undefined,
      depth: numberOrNull(row.length_mm) ?? undefined,
      weight: numberOrNull(row.weight_g) ?? undefined,
    },
    // Design numbers preserve existing product URLs and order item identities.
    itemCode: row.design_no,
    itemGroup: row.group_name ?? "",
    erpName: row.design_no,
    subject: row.subject ?? "",
    tags,
    stockStatus: row.stock_status ?? "",
    minOrderQty: numberOrNull(row.min_order_qty),
    orderMultiple: numberOrNull(row.order_multiple),
    gstPct: numberOrNull(row.gst_pct),
    hasPrice: price > 0,
    updatedAt: row.updated_at,
  };
}

const readCatalogProducts = unstable_cache(
  async (): Promise<CatalogProduct[]> => {
    const supabase = getSupabaseServerClient();
    const pageSize = 1000;
    const products: CatalogProduct[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("v_web_products")
        .select("*")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1)
        .returns<WebProductRow[]>();

      if (error)
        throw new Error(`Product catalogue unavailable: ${error.message}`);

      const rows = data ?? [];
      products.push(...rows.map(mapCatalogRowToProduct));
      if (rows.length < pageSize) break;
    }

    return products;
  },
  ["buildErpProductList"],
  { revalidate: 60 },
);

// Deduplicate concurrent metadata/page reads as well as caching across requests.
// Only base prices belong in this cache; visitor-specific pricing stays outside.
export const buildErpProductList = cache(
  async function buildErpProductList(): Promise<CatalogProduct[]> {
    return readCatalogProducts();
  },
);

export async function fetchErpProductsBase(): Promise<CatalogProduct[]> {
  return buildErpProductList();
}

export async function fetchErpProducts(): Promise<CatalogProduct[]> {
  return applyResellerPricingToProducts(await buildErpProductList());
}

export async function fetchWeddingCardProductsBase(): Promise<
  CatalogProduct[]
> {
  return (await buildErpProductList())
    .filter(isWeddingCardProduct)
    .sort((a, b) => {
      const photoDifference =
        Number(b.images.some((image) => image.trim())) -
        Number(a.images.some((image) => image.trim()));
      const priceDifference = Number(b.hasPrice) - Number(a.hasPrice);
      const newestDifference =
        (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
      return (
        photoDifference ||
        priceDifference ||
        newestDifference ||
        a.slug.localeCompare(b.slug, "en")
      );
    });
}

export async function fetchWeddingCardProducts(): Promise<CatalogProduct[]> {
  return applyResellerPricingToProducts(await fetchWeddingCardProductsBase());
}

export async function fetchErpProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const products = await buildErpProductList();
  return applyResellerPricingToProduct(
    products.find((product) => product.slug === slug) ?? null,
  );
}

export async function fetchErpProductsByCategory(
  category: ProductCategory,
): Promise<CatalogProduct[]> {
  if (category === "wedding") return fetchWeddingCardProducts();
  const products = await fetchErpProducts();
  return products.filter((product) => product.category === category);
}

export async function fetchErpProductsBySubject(
  subject: string | string[],
): Promise<CatalogProduct[]> {
  const subjects = new Set(
    (Array.isArray(subject) ? subject : [subject])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  if (subjects.size === 0) return [];

  const products = await buildErpProductList();
  return applyResellerPricingToProducts(
    products.filter((product) =>
      subjects.has(product.subject.trim().toLowerCase()),
    ),
  );
}

export const getCatalogProducts = fetchErpProducts;
export const getProductBySlug = fetchErpProductBySlug;
export const getProductsBySubject = fetchErpProductsBySubject;
