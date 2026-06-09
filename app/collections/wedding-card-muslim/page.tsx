import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/erpnext";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECT = "Muslim";

export const metadata: Metadata = {
  title: "Muslim Wedding Cards – Beyond Invitation",
  description:
    "A curated collection of Muslim wedding invitation cards — elegant calligraphy, intricate geometry and refined craftsmanship for the nikah and walima.",
};

export default async function MuslimWeddingCardPage() {
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
      title="Muslim Wedding Cards"
      description="Elegant calligraphy, intricate geometry and refined craftsmanship — invitations thoughtfully designed for the nikah, walima and special celebrations."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Muslim cards just yet"
      emptyDescription="There are no items with Subject set to Muslim and Show on Website enabled in ERPNext right now. Once they are tagged, they will appear here automatically."
      subjectLabel={SUBJECT}
      accentIcon="☾"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Wedding Card", href: "/collections/wedding-card" },
        { label: "Muslim" },
      ]}
    />
  );
}