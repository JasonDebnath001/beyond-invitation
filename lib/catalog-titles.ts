import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type DescriptionTitle = {
  id: string;
  item_id: string;
  line_no: number | null;
  title: string | null;
};

/** Enrich published catalogue rows; their existing name is the print_name fallback. */
export async function applyCatalogTitles<T extends { id: string; name: string }>(
  rows: T[],
  db?: SupabaseClient,
): Promise<T[]> {
  if (!rows.length) return rows;
  const client = db ?? getSupabaseAdminClient();
  const titles = new Map<string, string>();

  // Bound URL length, and page because each item can have several descriptions.
  for (let offset = 0; offset < rows.length; offset += 200) {
    const itemIds = rows.slice(offset, offset + 200).map((row) => row.id);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from("item_descriptions")
        .select("id,item_id,line_no,title")
        .in("item_id", itemIds)
        .order("line_no", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, from + 999)
        .returns<DescriptionTitle[]>();
      if (error) throw new Error(`Product titles unavailable: ${error.message}`);

      for (const row of data ?? []) {
        const title = row.title?.trim();
        if (title && !titles.has(row.item_id)) titles.set(row.item_id, title);
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  }

  return rows.map((row) => ({ ...row, name: titles.get(row.id) ?? row.name }));
}
