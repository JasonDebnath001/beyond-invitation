import type { Metadata } from "next";

import { fetchProductsByItemCategory, type CategorizedCatalogProduct } from "@/lib/catalog-item-category";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ITEM_CATEGORY = "Wedding Card";

export const metadata: Metadata = {
  title: "Christian Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Christian wedding invitation cards — elegant church wedding invites, graceful typography and timeless printed designs.",
};

export default async function ChristianWeddingCardPage() {
  let products: CategorizedCatalogProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchProductsByItemCategory(ITEM_CATEGORY);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from Catalogue.";
  }

  return (
    <WeddingCardsCollection
      title="Christian Wedding Cards"
      collectionType="christian"
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Christian wedding cards just yet"
    />
  );
}
