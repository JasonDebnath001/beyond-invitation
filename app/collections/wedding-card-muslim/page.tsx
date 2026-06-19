import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/erpnext";
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
        : "Unable to fetch products from ERPNext.";
  }

  return (
    <CollectionPageShell
      eyebrow="Wedding Card Collection"
      title="Muslim Wedding Cards"
      description="Elegant layouts, refined details and graceful invitation designs — crafted for nikah, walima and Muslim wedding celebrations."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Muslim wedding cards just yet"
      emptyDescription="There are no items with Subject set to Muslim Wedding Card or Wedding Card and Show on Website enabled in ERPNext right now. Once they are tagged, they will appear here automatically."
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