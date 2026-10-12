import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WebProductRow } from "@/lib/catalog";

export interface StorefrontRow extends WebProductRow {
  item_category: string;
}

export interface StorefrontPageQuery {
  p_offset?: number;
  p_limit?: number;
  p_category?: string;
  p_subjects?: string[];
  p_item_category?: string;
  p_wedding_only?: boolean;
  p_wedding_collection?: boolean;
  p_exclude_slug?: string;
  p_sort?: string;
  p_price_min?: number;
  p_price_max?: number;
  p_price_max_inclusive?: boolean;
  p_price_min_exclusive?: boolean;
  p_priced_only?: boolean;
  p_on_request?: boolean;
  p_margin_percent?: number;
  p_filter_item_category?: string;
  p_include_facets?: boolean;
}

export interface StorefrontPageResult {
  products: StorefrontRow[];
  nextOffset: number | null;
  total: number;
  facets: null | {
    total: number;
    types: Record<string, number>;
    prices: Record<string, number>;
  };
}

// Deploy the application and migration in either order. Only a missing schema
// object triggers the legacy reader; permission, pricing and network errors fail.
const unavailableUntil = new Map<string, number>();
function missingContract(
  error: { code?: string; message: string },
  resource: string,
) {
  if (
    ["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "") &&
    error.message.includes(resource)
  ) {
    unavailableUntil.set(resource, Date.now() + 60_000);
    console.warn(
      "Optimized storefront query is not installed. Apply 20261012_storefront_products.sql.",
    );
    return true;
  }
  return false;
}

/** null means the migration is not installed; [] is a valid empty result. */
export async function readStorefrontRows(
  options: { slug?: string; offset?: number; limit?: number } = {},
): Promise<StorefrontRow[] | null> {
  const resource = "v_storefront_products";
  if ((unavailableUntil.get(resource) ?? 0) > Date.now()) return null;
  let query = getSupabaseServerClient().from(resource).select("*");
  if (options.slug !== undefined) query = query.eq("slug", options.slug);
  const offset = options.offset ?? 0;
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + (options.limit ?? 1000) - 1)
    .returns<StorefrontRow[]>();
  if (error) {
    if (missingContract(error, resource)) return null;
    throw new Error(`Product catalogue unavailable: ${error.message}`);
  }
  return data ?? [];
}

/** Returns base prices; the margin parameter only controls filtering and order. */
export async function readStorefrontPage(
  query: StorefrontPageQuery,
): Promise<StorefrontPageResult | null> {
  const resource = "storefront_product_page";
  if ((unavailableUntil.get(resource) ?? 0) > Date.now()) return null;
  const { data, error } = await getSupabaseServerClient().rpc(resource, query);
  if (error) {
    if (missingContract(error, resource)) return null;
    throw new Error(`Product catalogue unavailable: ${error.message}`);
  }
  if (
    !data ||
    !Array.isArray(data.products) ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    (data.nextOffset !== null &&
      (!Number.isSafeInteger(data.nextOffset) ||
        data.nextOffset <= (query.p_offset ?? 0)))
  ) {
    throw new Error("Product catalogue returned an invalid page.");
  }
  return data as StorefrontPageResult;
}
