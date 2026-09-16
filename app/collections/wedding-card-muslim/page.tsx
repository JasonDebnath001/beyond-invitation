import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/catalog";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS = ["Muslim Wedding Card", "Wedding Card"];

export const metadata: Metadata = {
  title: "Muslim Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Muslim wedding invitation cards — elegant layouts, refined details and graceful designs for nikah and wedding celebrations.",
};

export default async function MuslimWeddingCardPage() {
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
      title="Muslim Wedding Cards"
      description="Elegant layouts, refined details and graceful invitation designs — crafted for nikah, walima and Muslim wedding celebrations."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Muslim wedding cards just yet"
      emptyDescription="This collection is being updated. Please check back soon or contact us for help finding your invitation."
      subjectLabel="Muslim Wedding Card + Wedding Card"
      accentIcon="☾"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Wedding Card", href: "/collections/wedding-card" },
        { label: "Muslim" },
      ]}
    />
  );
}