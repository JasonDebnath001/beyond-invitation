import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/erpnext";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECT = "Christian";

export const metadata: Metadata = {
  title: "Christian Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Christian wedding invitation cards — graceful florals, classic typography and refined craftsmanship for the ceremony and reception.",
};

export default async function ChristianWeddingCardPage() {
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject(SUBJECT);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from ERPNext.";
  }

  return (
    <CollectionPageShell
      eyebrow="Wedding Card Collection"
      title="Christian Wedding Cards"
      description="Graceful florals, classic typography and refined craftsmanship — invitations thoughtfully designed for the church ceremony and reception."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Christian cards just yet"
      emptyDescription="There are no items with Subject set to Christian and Show on Website enabled in ERPNext right now. Once they are tagged, they will appear here automatically."
      subjectLabel={SUBJECT}
      accentIcon="✝"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Wedding Card", href: "/collections/wedding-card" },
        { label: "Christian" },
      ]}
    />
  );
}