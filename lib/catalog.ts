import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import type { Product, ProductCategory } from "@/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { applyCatalogDetails } from "@/lib/catalog-pricing";
import { PRODUCTS_PER_PAGE } from "@/lib/product-page";
import { readStorefrontPage, readStorefrontRows } from "@/lib/storefront-data";
import {
  applyResellerPricingToProducts,
  applyResellerPricingToProduct,
} from "@/lib/reseller";

export type CatalogProduct = Product & {
  catalogId: string;
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
  itemCategory?: string;
};

/** Compatibility with the existing page and checkout imports. */
export type ErpProduct = CatalogProduct;

type NullableNumber = number | string | null;

/** Public product content; Selling prices and Web Titles are applied server-side. */
export interface WebProductRow {
  id: string;
  item_code: string;
  design_no: string;
  print_name?: string | null;
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
  item_category?: string;
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
  // Filename positions define gallery order and the main image everywhere.
  // Unnumbered images follow numbered ones, retaining their original order.
  const images = mediaList([row.image_url, ...mediaList(row.images)]).sort(
    (a, b) => photoOrder(a) - photoOrder(b),
  );

  return {
    catalogId: row.id,
    slug: row.slug,
    name: row.name,
    price,
    mrp: numberOrNull(row.mrp) ?? 0,
    images,
    imageCount: images.length,
    videos: mediaList(row.videos),
    emoji: "",
    category: normalizeCategory(row.subject),
    badge: row.badge || tags[0],
    description: DOMPurify.sanitize(row.description ?? ""),
    // Legacy *_mm view aliases contain item-master lengths in centimetres.
    dimensions: {
      height: numberOrNull(row.height_mm) ?? undefined,
      width: numberOrNull(row.width_mm) ?? undefined,
      depth: numberOrNull(row.length_mm) ?? undefined,
      weight: numberOrNull(row.weight_g) ?? undefined,
    },
    // Design numbers preserve existing product URLs and order item identities.
    itemCode: row.design_no,
    printName: row.print_name?.trim() || undefined,
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
    itemCategory: row.item_category,
  };
}

export async function resolveCatalogProducts(
  rows: WebProductRow[],
): Promise<CatalogProduct[]> {
  const resolvedRows = await applyCatalogDetails(rows);
  return resolvedRows.map(mapCatalogRowToProduct);
}

const readCatalogProducts = unstable_cache(
  async (): Promise<CatalogProduct[]> => {
    const supabase = getSupabaseServerClient();
    const pageSize = 1000;
    const products: CatalogProduct[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const optimized = await readStorefrontRows({ offset, limit: pageSize });
      if (optimized !== null) {
        products.push(...optimized.map(mapCatalogRowToProduct));
        if (optimized.length < pageSize) break;
        continue;
      }
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
      products.push(...(await resolveCatalogProducts(rows)));
      if (rows.length < pageSize) break;
    }

    return products;
  },
  ["buildErpProductList-v9-print-name"],
  { revalidate: 60, tags: ["catalogue"] },
);

// Detail pages need only one published product, even when the full catalogue
// cache is cold. Keep Selling prices and Web Titles on the same resolution path.
const readCatalogProductBySlug = unstable_cache(
  async (slug: string): Promise<CatalogProduct | null> => {
    const optimized = await readStorefrontRows({ slug, limit: 1 });
    if (optimized !== null)
      return optimized[0] ? mapCatalogRowToProduct(optimized[0]) : null;
    const { data, error } = await getSupabaseServerClient()
      .from("v_web_products")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .returns<WebProductRow[]>();

    if (error)
      throw new Error(`Product catalogue unavailable: ${error.message}`);
    if (!data?.length) return null;

    return (await resolveCatalogProducts(data))[0] ?? null;
  },
  ["catalogProductBySlug-v3-print-name"],
  { revalidate: 60, tags: ["catalogue"] },
);

// The optimized reader filters before pagination. The legacy priced-only path
// must resolve Selling prices before filtering; its public view has older prices.
const readCatalogProductPage = unstable_cache(
  async (
    offset: number,
    pricedOnly = false,
  ): Promise<{
    products: CatalogProduct[];
    nextOffset: number | null;
  }> => {
    const optimized = await readStorefrontPage({
      p_offset: offset,
      p_limit: PRODUCTS_PER_PAGE,
      ...(pricedOnly ? { p_priced_only: true } : {}),
    });
    if (optimized !== null)
      return {
        products: optimized.products.map(mapCatalogRowToProduct),
        nextOffset: optimized.nextOffset,
      };
    if (pricedOnly) {
      const products = (await readCatalogProducts()).filter(
        (product) => Number.isFinite(product.price) && product.price > 0,
      );
      const end = offset + PRODUCTS_PER_PAGE;
      return {
        products: products.slice(offset, end),
        nextOffset: end < products.length ? end : null,
      };
    }
    // An extra source row detects the next unfiltered page without resolving
    // the full catalogue. The sentinel is not sent to the browser.
    const { data, error } = await getSupabaseServerClient()
      .from("v_web_products")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PRODUCTS_PER_PAGE)
      .returns<WebProductRow[]>();

    if (error)
      throw new Error(`Product catalogue unavailable: ${error.message}`);

    const rows = data ?? [];
    return {
      products: rows.length
        ? await resolveCatalogProducts(rows.slice(0, PRODUCTS_PER_PAGE))
        : [],
      // Advance by source rows, even if an item was unpublished during
      // enrichment. Advancing by the surviving count would repeat products.
      nextOffset:
        rows.length > PRODUCTS_PER_PAGE ? offset + PRODUCTS_PER_PAGE : null,
    };
  },
  ["catalogProductPage-v4-priced-only", String(PRODUCTS_PER_PAGE)],
  { revalidate: 60, tags: ["catalogue"] },
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

/** Cache only this page's base products, then price it for the current visitor. */
export async function fetchErpProductPage(offset = 0, pricedOnly = false): Promise<{
  products: CatalogProduct[];
  nextOffset: number | null;
}> {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 2147483647 - PRODUCTS_PER_PAGE
  ) {
    throw new Error("Provide a valid product offset.");
  }
  const page = await readCatalogProductPage(offset, pricedOnly);
  return {
    products: await applyResellerPricingToProducts(page.products),
    nextOffset: page.nextOffset,
  };
}

export async function fetchWeddingCardProductsBase(): Promise<
  CatalogProduct[]
> {
  return (await buildErpProductList())
    .filter(isWeddingCardProduct)
    .sort(compareWeddingCardProducts);
}

export function compareWeddingCardProducts(
  a: CatalogProduct,
  b: CatalogProduct,
) {
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
}

// Metadata and the page share one lookup and one visitor-pricing operation per
// render. Only the base product enters the persistent cache above.
export const fetchErpProductBySlug = cache(
  async (slug: string): Promise<CatalogProduct | null> =>
    applyResellerPricingToProduct(await readCatalogProductBySlug(slug)),
);

/** Read one published gallery on demand without any visitor-pricing lookup. */
export async function fetchErpProductImages(slug: string): Promise<string[] | null> {
  return (await readCatalogProductBySlug(slug))?.images ?? null;
}

/** Preserve collection ordering, but only reprice the related products shown. */
export async function fetchRelatedErpProducts(
  product: Pick<CatalogProduct, "slug" | "category">,
  limit = 4,
): Promise<CatalogProduct[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) return [];
  const optimized = await readRelatedStorefrontProducts(
    product.slug,
    product.category,
    limit,
  );
  if (optimized !== null) return applyResellerPricingToProducts(optimized);
  const products =
    product.category === "wedding"
      ? await fetchWeddingCardProductsBase()
      : (await buildErpProductList()).filter(
          (candidate) => candidate.category === product.category,
        );
  return applyResellerPricingToProducts(
    products
      .filter((candidate) => candidate.slug !== product.slug)
      .slice(0, limit),
  );
}

const readRelatedStorefrontProducts = unstable_cache(
  async (slug: string, category: string, limit: number) => {
    const result = await readStorefrontPage({
      p_limit: limit,
      p_exclude_slug: slug,
      ...(category === "wedding"
        ? { p_wedding_only: true, p_sort: "recommended" }
        : { p_category: category }),
    });
    return result === null ? null : result.products.map(mapCatalogRowToProduct);
  },
  ["relatedStorefrontProducts-v2-print-name"],
  { revalidate: 60, tags: ["catalogue"] },
);

export const getCatalogProducts = fetchErpProducts;
