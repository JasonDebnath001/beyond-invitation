import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Stable, paginated galleries scoped to the requested company and item IDs. */
export async function loadItemGalleries(companyId: string, itemIds: string[], signal: AbortSignal) {
  const db = getSupabaseAdminClient();
  const galleries = new Map<string, string[]>();
  let nextChunk = 0;
  async function readChunk(start: number) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("item_images")
        .select("item_id,image_url")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .in("item_id", itemIds.slice(start, start + 200))
        .order("sort_order", { nullsFirst: false })
        .order("created_at")
        .order("id")
        .range(offset, offset + 999)
        .abortSignal(signal);
      if (error) throw new Error(`Cannot load card photos: ${error.message}`);
      for (const row of data ?? []) {
        const images = galleries.get(row.item_id) ?? [];
        if (row.image_url) images.push(row.image_url);
        galleries.set(row.item_id, images);
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(4, Math.ceil(itemIds.length / 200)) }, async () => {
      while (nextChunk < itemIds.length) {
        const start = nextChunk;
        nextChunk += 200;
        await readChunk(start);
      }
    }),
  );
  return galleries;
}
