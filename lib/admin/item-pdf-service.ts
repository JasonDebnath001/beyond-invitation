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
  // Read only this company's selected items, with pagination for large galleries.
  for (let start = 0; start < items.length; start += 100) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("item_images")
        .select("item_id,image_url")
        .eq("company_id", companyId)
        .eq("is_deleted", false)
        .in(
          "item_id",
          items.slice(start, start + 100).map((item) => item.id),
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
  return {
    title: categoryPdfTitle(category.label),
    items: items.map((item) => ({
      id: item.id,
      name: item.printName.trim() || item.designNo,
      designNo: item.designNo,
      images: photosForPdf([item.imageUrl, ...(galleries.get(item.id) ?? [])]),
    })),
  };
}
