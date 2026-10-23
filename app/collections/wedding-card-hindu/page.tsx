import type { Metadata } from "next";

import { fetchWeddingProductPage } from "@/lib/catalog-browse";
import {
  facetCounts,
  weddingFiltersFromSearchParams,
  type WeddingProductPage,
  type WeddingSearchParams,
} from "@/lib/wedding-cards";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Hindu Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Hindu wedding invitation cards — sacred motifs, auspicious hues and timeless craftsmanship for the big day.",
};

export default async function HinduWeddingCardPage({
  searchParams,
}: {
  searchParams: Promise<WeddingSearchParams>;
}) {
  const initialFilters = weddingFiltersFromSearchParams(
    await searchParams,
    "hindu",
  );
  let initialPage: WeddingProductPage = {
    products: [],
    nextOffset: null,
    total: 0,
    facets: facetCounts([]),
  };
  let errorMessage = "";

  try {
    initialPage = await fetchWeddingProductPage({
      collectionType: "hindu",
      filters: initialFilters,
    });
  } catch (error) {
    console.error("Hindu wedding cards page fetch failed:", error);
    errorMessage = "Unable to load wedding cards.";
  }

  return (
    <WeddingCardsCollection
      title="Hindu Wedding Cards"
      collectionType="hindu"
      initialPage={initialPage}
      initialFilters={initialFilters}
      errorMessage={errorMessage}
      emptyTitle="No Hindu wedding cards with prices yet"
    />
  );
}
