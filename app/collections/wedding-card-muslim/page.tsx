import type { Metadata } from "next";

import { fetchProductsByItemCategory, type CategorizedCatalogProduct } from "@/lib/catalog-item-category";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ITEM_CATEGORY = "Wedding Card";

export const metadata: Metadata = {
  title: "Muslim Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Muslim wedding invitation cards — elegant layouts, refined details and graceful designs for nikah and wedding celebrations.",
};

export default async function MuslimWeddingCardPage() {
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
      title="Muslim Wedding Cards"
      collectionType="muslim"
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Muslim wedding cards just yet"
    />
  );
}
