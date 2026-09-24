import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadItemLibrary } from "./item-service";
import {
  categoryPdfTitle,
  itemsForPdf,
  pdfCategories,
  photosForPdf,
  type CategoryPdfData,
} from "./item-pdf-selection";

export class CategoryPdfError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function loadCategoryPdfData(
  companyId: string,
  selection: string,
  signal: AbortSignal,
  onlyWithPhotos = true,
): Promise<CategoryPdfData> {
  if (!companyId || !selection)
    throw new CategoryPdfError("Choose a company and category for the PDF.");
  const library = await loadItemLibrary(companyId, signal);
  const category = pdfCategories(library.items).find(
    (entry) => entry.value === selection,
  );
  if (!category)
    throw new CategoryPdfError(
      "This category is unavailable. Refresh the library.",
    );
  const items = itemsForPdf(library.items, category);
  if (!items.length)
    throw new CategoryPdfError(
      "There are no items in this category to export.",
      404,
    );

  const db = getSupabaseAdminClient();
  const galleries = new Map<string, string[]>();
  // Read 200 items per chunk, with four chunks in flight and stable pagination.
  let nextChunk = 0;
  async function readChunk(start: number) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("item_images")
        .select("item_id,image_url")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .in(
          "item_id",
          items.slice(start, start + 200).map((item) => item.id),
        )
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
    Array.from(
      { length: Math.min(4, Math.ceil(items.length / 200)) },
      async () => {
        while (nextChunk < items.length) {
          const start = nextChunk;
          nextChunk += 200;
          await readChunk(start);
        }
      },
    ),
  );
  const mappedItems = items.map((item) => ({
    id: item.id,
    name: item.printName.trim() || item.designNo,
    designNo: item.designNo,
    images: photosForPdf([item.imageUrl, ...(galleries.get(item.id) ?? [])]),
  }));
  const exportItems = onlyWithPhotos
    ? mappedItems.filter((item) => item.images.length > 0)
    : mappedItems;
  if (!exportItems.length)
    throw new CategoryPdfError(
      'No cards with photos in this category. Turn off "Only cards with photos" to include cards without photos.',
      404,
    );
  return {
    title: categoryPdfTitle(category.label),
    skippedItemCount: mappedItems.length - exportItems.length,
    items: exportItems,
  };
}
