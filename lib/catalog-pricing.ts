import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type PriceRow = { id: string; price: number | string | null; mrp: number | string | null };

/** Only supplement products already admitted by the public catalogue view.
 * Explicit item prices take priority over the selected Selling price list.
 * Null actual price restores the view's price-list behavior.
 */
export async function applyItemPrices<T extends PriceRow>(
  rows: T[],
  db = getSupabaseAdminClient(),
): Promise<T[]> {
  const prices = new Map<string, { sale_price: number | null; mrp: number | null }>();
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { data, error } = await db.from("items")
      .select("id,sale_price,mrp")
      .in("id", rows.slice(offset, offset + 200).map((row) => row.id))
      .eq("show_on_website", true).eq("is_active", true);
    if (error) throw new Error(`Product prices unavailable: ${error.message}`);
    for (const item of data ?? []) prices.set(item.id, item);
  }
  return rows.filter((row) => prices.has(row.id)).map((row) => {
    const item = prices.get(row.id)!;
    return item.sale_price == null ? row : { ...row, price: item.sale_price, mrp: item.mrp };
  });
}
