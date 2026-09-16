import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/catalog";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS = ["Christian Wedding Card", "Wedding Card"];

export const metadata: Metadata = {
  title: "Christian Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Christian wedding invitation cards — elegant church wedding invites, graceful typography and timeless printed designs.",
};

export default async function ChristianWeddingCardPage() {
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject(SUBJECTS);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from Catalogue.";
  }

  return (
    <CollectionPageShell
      eyebrow="Wedding Card Collection"
      title="Christian Wedding Cards"
      description="Elegant church wedding invitations, graceful typography and timeless printed designs — crafted to announce Christian weddings with warmth and beauty."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Christian wedding cards just yet"
      emptyDescription="This collection is being updated. Please check back soon or contact us for help finding your invitation."
      subjectLabel="Christian Wedding Card + Wedding Card"
      accentIcon="✝"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Wedding Card", href: "/collections/wedding-card" },
        { label: "Christian" },
      ]}
    />
  );
}