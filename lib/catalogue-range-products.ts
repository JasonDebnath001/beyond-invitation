import "server-only";

import { fetchWeddingCardProductsBase } from "@/lib/catalog";
import { COLLECTION_PAGE_SIZE, type CatalogBrowsePage } from "@/lib/catalog-browse-options";
import { getCatalogueRange, isInCatalogueRange, type CatalogueRangeId } from "@/lib/catalogue-ranges";
import { applyResellerPricingToProducts } from "@/lib/reseller";

export async function fetchCatalogueRangePage(
  rangeId: CatalogueRangeId,
  offset = 0,
): Promise<CatalogBrowsePage> {
  const range = getCatalogueRange(rangeId);
  if (!range || !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647 - COLLECTION_PAGE_SIZE) {
    throw new Error("Provide a valid catalogue range and offset.");
  }

  // The existing page RPC filters selling price. These homepage bands use MRP,
  // so filter the cached wedding-card catalogue before slicing a response page.
  // Visitor pricing stays outside the shared cache and is applied exactly once.
  const products = await applyResellerPricingToProducts(await fetchWeddingCardProductsBase());
  const matches = products.filter((product) => isInCatalogueRange(product.mrp, range));
  const end = offset + COLLECTION_PAGE_SIZE;

  return {
    products: matches.slice(offset, end).map((product) => ({
      ...product,
      imageCount: product.images.length,
      images: product.images.slice(0, 1),
      videos: [],
      description: "",
      dimensions: undefined,
    })),
    total: matches.length,
    nextOffset: end < matches.length ? end : null,
  };
}
