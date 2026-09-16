import type { Metadata } from "next";

import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/catalog";
import CollectionPageShell from "@/components/CollectionPageShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECT = "Shagun Envelopes";

export const metadata: Metadata = {
  title: "Shagun Envelopes – Beyond Invitation",
  description:
    "Explore premium Shagun Envelopes from Beyond Invitation.",
};

export default async function ShagunEnvelopesPage() {
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject(SUBJECT);
  } catch (error) {
    console.error("Catalogue Shagun Envelopes fetch failed:", error);

    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch Shagun Envelopes from Catalogue.";
  }

  return (
    <CollectionPageShell
      eyebrow="Premium Collection"
      title="Shagun Envelopes"
      description="Premium envelopes for weddings, gifting, festive celebrations and special occasions."
      products={products}
      errorMessage={errorMessage}
      emptyTitle="No Shagun Envelopes found"
      emptyDescription="This collection is being updated. Please check back soon or contact us for help finding your invitation."
      subjectLabel={SUBJECT}
      accentIcon="✉"
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Shagun Envelopes" },
      ]}
    />
  );
}