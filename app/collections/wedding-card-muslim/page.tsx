import type { Metadata } from "next";

import { fetchWeddingProductPage } from "@/lib/catalog-browse";
import { facetCounts, weddingFiltersFromSearchParams, type WeddingProductPage, type WeddingSearchParams } from "@/lib/wedding-cards";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Muslim Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Muslim wedding invitation cards — elegant layouts, refined details and graceful designs for nikah and wedding celebrations.",
};

export default async function MuslimWeddingCardPage({ searchParams }: { searchParams: Promise<WeddingSearchParams> }) {
  const initialFilters = weddingFiltersFromSearchParams(await searchParams, "muslim");
  let initialPage: WeddingProductPage = { products: [], nextOffset: null, total: 0, facets: facetCounts([]) };
  let errorMessage = "";

  try {
    initialPage = await fetchWeddingProductPage({ collectionType: "muslim", filters: initialFilters });
  } catch (error) {
    console.error("Muslim wedding cards page fetch failed:", error);
    errorMessage = "Unable to load wedding cards.";
  }

  return (
    <WeddingCardsCollection
      title="Muslim Wedding Cards"
      collectionType="muslim"
      initialPage={initialPage}
      initialFilters={initialFilters}
      errorMessage={errorMessage}
      emptyTitle="No Muslim wedding cards just yet"
    />
  );
}
