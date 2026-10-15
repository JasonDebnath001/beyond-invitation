import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ItemWebTitle = {
  id: string;
  web_title: string | null;
};

/** Use Web Title for published products, falling back to the view's print/design name. */
export async function applyCatalogTitles<T extends { id: string; name: string }>(
  rows: T[],
  db?: SupabaseClient,
): Promise<T[]> {
  if (!rows.length) return rows;
  const client = db ?? getSupabaseAdminClient();
  const titles = new Map<string, string>();

  // Only look up published catalogue IDs, keeping each batch below the row limit.
  for (let offset = 0; offset < rows.length; offset += 200) {
    const itemIds = rows.slice(offset, offset + 200).map((row) => row.id);
    const { data, error } = await client.from("items")
      .select("id,web_title")
      .in("id", itemIds)
      .returns<ItemWebTitle[]>();
    if (error) throw new Error(`Product titles unavailable: ${error.message}`);

    for (const row of data ?? []) {
      const title = row.web_title?.trim();
      if (title) titles.set(row.id, title);
    }
  }

  return rows.map((row) => ({ ...row, name: titles.get(row.id) ?? row.name }));
}

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
