import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Enrich only older view/RPC rows that do not yet expose the Print Name column. */
export async function applyCatalogPrintNames<T extends { id: string }>(
  rows: T[],
  db?: SupabaseClient,
): Promise<T[]> {
  const missingIds = [...new Set(rows
    .filter((row) => !Object.prototype.hasOwnProperty.call(row, "print_name"))
    .map((row) => row.id))];
  if (!missingIds.length) return rows;

  const client = db ?? getSupabaseAdminClient();
  const printNames = new Map<string, string | null>();
  for (let offset = 0; offset < missingIds.length; offset += 200) {
    const { data, error } = await client.from("items")
      .select("id,print_name")
      .in("id", missingIds.slice(offset, offset + 200))
      .eq("show_on_website", true).eq("is_active", true)
      .returns<{ id: string; print_name: string | null }[]>();
    if (error) throw new Error(`Product Print Names unavailable: ${error.message}`);
    for (const item of data ?? []) printNames.set(item.id, item.print_name);
  }

  return rows.map((row) => Object.prototype.hasOwnProperty.call(row, "print_name")
    ? row
    : { ...row, print_name: printNames.get(row.id) ?? null });
}
