import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/erpnext";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS = ["Hindu Wedding Card", "Wedding Card"];

export const metadata: Metadata = {
  title: "Hindu Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Hindu wedding invitation cards — sacred motifs, auspicious hues and timeless craftsmanship for the big day.",
};

export default async function HinduWeddingCardPage() {
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject(SUBJECTS);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from ERPNext.";
  }

  return (
    <CollectionPageShell
      eyebrow="Wedding Card Collection"
      title="Hindu Wedding Cards"
      description="Sacred motifs, auspicious hues and heirloom craftsmanship — invitations thoughtfully designed to announce a Hindu wedding with grace."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Hindu wedding cards just yet"
      emptyDescription="There are no items with Subject set to Hindu Wedding Card or Wedding Card and Show on Website enabled in ERPNext right now. Once they are tagged, they will appear here automatically."
      subjectLabel="Hindu Wedding Card + Wedding Card"
      accentIcon="ॐ"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Wedding Card", href: "/collections/wedding-card" },
        { label: "Hindu" },
      ]}
    />
  );
}