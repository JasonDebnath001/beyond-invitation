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
  created_at?: string | null;
  updated_at?: string | null;
  is_draft?: boolean;
};
type StoredPriceRow = Omit<SellingPriceRow, "price_list_id"> & {
  price_list_id: string | null;
  transaction_id: string | null;
  transaction_type: string | null;
  company_id: string;
  row_status: string;
};
type DraftTransaction = {
  id: string;
  company_id: string;
  price_list_id: string | null;
  effective_from: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function descendingNumber(a: NullableNumber, b: NullableNumber): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return Number(b) - Number(a);
}

function revisionTime(row: Pick<SellingPriceRow, "created_at" | "updated_at">): number {
  return Math.max(Date.parse(row.created_at ?? "") || 0, Date.parse(row.updated_at ?? "") || 0);
}

function compareRevisions(a: SellingPriceRow, b: SellingPriceRow): number {
  return (b.effective_from ?? "").localeCompare(a.effective_from ?? "") ||
    revisionTime(b) - revisionTime(a) ||
    Number(!!b.is_draft) - Number(!!a.is_draft) ||
    descendingNumber(a.website_price, b.website_price) ||
    descendingNumber(a.rate, b.rate) ||
    descendingNumber(a.discount_pct, b.discount_pct) ||
    descendingNumber(a.gst_pct, b.gst_pct) ||
    a.id.localeCompare(b.id);
}

/** Resolve the latest revision within each list, including drafts, then apply list preference. */
export function selectSellingPrice(
  rows: SellingPriceRow[],
  preferredListId: string | null,
  listCodes: Map<string, string>,
): SellingPriceRow | undefined {
  const latestByList = new Map<string, SellingPriceRow>();
  for (const row of rows) {
    if (!listCodes.has(row.price_list_id)) continue;
    const previous = latestByList.get(row.price_list_id);
    if (!previous || compareRevisions(row, previous) < 0) latestByList.set(row.price_list_id, row);
  }
  return [...latestByList.values()].sort((a, b) =>
    Number(b.price_list_id === preferredListId) - Number(a.price_list_id === preferredListId) ||
    Number(b.website_price != null) - Number(a.website_price != null) ||
    Number(listCodes.get(b.price_list_id) === "PL0001") - Number(listCodes.get(a.price_list_id) === "PL0001") ||
    (b.effective_from ?? "").localeCompare(a.effective_from ?? "") ||
    a.price_list_id.localeCompare(b.price_list_id),
  )[0];
}

/**
 * Only price products admitted by the public view and still published.
 * Both values come from one eligible Active or Draft Selling row: website_price -> price,
 * rate -> mrp. Missing website_price stays unpriced; item overrides and the
 * view's legacy discount/MRP fallbacks are deliberately not used.
 */
export async function applySellingPrices<T extends PriceRow>(
  rows: T[],
  db = getSupabaseAdminClient(),
): Promise<T[]> {
  const items = new Map<string, PublishedItem>();
  const candidates: StoredPriceRow[] = [];
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
        .select("id,item_id,company_id,transaction_id,transaction_type,row_status,price_list_id,website_price,rate,discount_pct,gst_pct,effective_from,created_at,updated_at")
        .in("item_id", data.map((item) => item.id))
        .eq("is_active", true)
        .or("and(row_status.eq.Active,transaction_type.eq.Selling),row_status.eq.Draft")
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("id", { ascending: true }).range(from, from + 999)
        .returns<StoredPriceRow[]>();
      if (priceError) throw new Error(`Product prices unavailable: ${priceError.message}`);
      candidates.push(...(priceRows ?? []));
      if ((priceRows?.length ?? 0) < 1000) break;
    }
  }

  // Draft lines do not receive their list/type until submission. Resolve those
  // fields from their active Selling draft header instead of treating null as Selling.
  const transactionIds = [...new Set(candidates.flatMap((row) =>
    row.row_status === "Draft" && row.transaction_id ? [row.transaction_id] : [],
  ))];
  const drafts = new Map<string, DraftTransaction>();
  for (let offset = 0; offset < transactionIds.length; offset += 200) {
    const { data, error } = await db.from("price_list_transactions")
      .select("id,company_id,price_list_id,effective_from,created_at,updated_at")
      .in("id", transactionIds.slice(offset, offset + 200))
      .eq("transaction_type", "Selling").eq("status", "Draft").eq("is_active", true)
      .returns<DraftTransaction[]>();
    if (error) throw new Error(`Product prices unavailable: ${error.message}`);
    for (const draft of data ?? []) drafts.set(draft.id, draft);
  }

  for (const row of candidates) {
    let price: SellingPriceRow;
    if (row.row_status === "Draft") {
      const draft = row.transaction_id ? drafts.get(row.transaction_id) : undefined;
      if (!draft?.price_list_id || draft.company_id !== row.company_id) continue;
      price = {
        ...row,
        price_list_id: draft.price_list_id,
        effective_from: draft.effective_from ?? row.effective_from,
        updated_at: new Date(Math.max(revisionTime(row), revisionTime(draft))).toISOString(),
        is_draft: true,
      };
    } else {
      if (row.row_status !== "Active" || row.transaction_type !== "Selling" || !row.price_list_id) continue;
      price = { ...row, price_list_id: row.price_list_id };
    }
    const itemPrices = prices.get(row.item_id) ?? [];
    itemPrices.push(price);
    prices.set(row.item_id, itemPrices);
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
