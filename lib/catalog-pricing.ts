import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type NullableNumber = number | string | null;
type PriceRow = { id: string; price: NullableNumber; mrp: NullableNumber };
type PublishedItem = { id: string; website_price_list_id: string | null };
export type SellingPriceRow = {
  id: string;
  item_id: string;
  price_list_id: string;
  website_price: NullableNumber;
  rate: NullableNumber;
  discount_pct: NullableNumber;
  gst_pct: NullableNumber;
  effective_from: string | null;
};

function descendingNumber(a: NullableNumber, b: NullableNumber): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return Number(b) - Number(a);
}

/** Preserve the public view's Selling row preference, with a stable final ID tie-break. */
export function selectSellingPrice(
  rows: SellingPriceRow[],
  preferredListId: string | null,
  listCodes: Map<string, string>,
): SellingPriceRow | undefined {
  return rows.filter((row) => listCodes.has(row.price_list_id)).sort((a, b) =>
    Number(b.price_list_id === preferredListId) - Number(a.price_list_id === preferredListId) ||
    Number(b.website_price != null) - Number(a.website_price != null) ||
    Number(listCodes.get(b.price_list_id) === "PL0001") - Number(listCodes.get(a.price_list_id) === "PL0001") ||
    (b.effective_from ?? "").localeCompare(a.effective_from ?? "") ||
    a.price_list_id.localeCompare(b.price_list_id) ||
    descendingNumber(a.website_price, b.website_price) ||
    descendingNumber(a.rate, b.rate) ||
    descendingNumber(a.discount_pct, b.discount_pct) ||
    descendingNumber(a.gst_pct, b.gst_pct) ||
    a.id.localeCompare(b.id),
  )[0];
}

/**
 * Only price products admitted by the public view and still published.
 * Both values come from one eligible Selling row: website_price -> price,
 * rate -> mrp. Missing website_price stays unpriced; item overrides and the
 * view's legacy discount/MRP fallbacks are deliberately not used.
 */
export async function applySellingPrices<T extends PriceRow>(
  rows: T[],
  db = getSupabaseAdminClient(),
): Promise<T[]> {
  const items = new Map<string, PublishedItem>();
  const prices = new Map<string, SellingPriceRow[]>();
  const listCodes = new Map<string, string>();
  // Match current_date in the hosted database (UTC).
  const today = new Date().toISOString().slice(0, 10);
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { data, error } = await db.from("items")
      .select("id,website_price_list_id")
      .in("id", rows.slice(offset, offset + 200).map((row) => row.id))
      .eq("show_on_website", true).eq("is_active", true)
      .returns<PublishedItem[]>();
    if (error) throw new Error(`Product prices unavailable: ${error.message}`);
    for (const item of data ?? []) items.set(item.id, item);
    if (!data?.length) continue;

    // A product can have many price rows. Page independently of the item batch.
    for (let from = 0; ; from += 1000) {
      const { data: priceRows, error: priceError } = await db
        .from("price_list_transaction_items")
        .select("id,item_id,price_list_id,website_price,rate,discount_pct,gst_pct,effective_from")
        .in("item_id", data.map((item) => item.id))
        .eq("transaction_type", "Selling")
        .eq("is_active", true).eq("row_status", "Active")
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("id", { ascending: true }).range(from, from + 999)
        .returns<SellingPriceRow[]>();
      if (priceError) throw new Error(`Product prices unavailable: ${priceError.message}`);
      for (const row of priceRows ?? []) {
        const itemPrices = prices.get(row.item_id) ?? [];
        itemPrices.push(row);
        prices.set(row.item_id, itemPrices);
      }
      if ((priceRows?.length ?? 0) < 1000) break;
    }
  }

  // This schema does not expose a PostgREST relationship to price_lists.
  const listIds = [...new Set([...prices.values()].flat().map((row) => row.price_list_id))];
  for (let offset = 0; offset < listIds.length; offset += 200) {
    const { data, error } = await db.from("price_lists").select("id,code")
      .in("id", listIds.slice(offset, offset + 200));
    if (error) throw new Error(`Product prices unavailable: ${error.message}`);
    for (const list of data ?? []) listCodes.set(list.id, list.code);
  }

  return rows.filter((row) => items.has(row.id)).map((row) => {
    const selected = selectSellingPrice(prices.get(row.id) ?? [], items.get(row.id)!.website_price_list_id, listCodes);
    return {
      ...row,
      price: selected?.website_price ?? null,
      mrp: selected?.rate ?? null,
      gst_pct: selected?.gst_pct ?? null,
    };
  });
}
