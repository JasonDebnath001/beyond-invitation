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
