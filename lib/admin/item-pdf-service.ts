import "server-only";
import { loadItemLibrary } from "./item-service";
import { loadItemGalleries } from "./item-gallery";
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

  const galleries = await loadItemGalleries(companyId, items.map((item) => item.id), signal);
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
