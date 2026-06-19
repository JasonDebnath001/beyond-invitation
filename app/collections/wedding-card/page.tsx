import type { Metadata } from "next";

import FilterableProductGrid from "@/components/FilterableProductGrid";
import {
  fetchErpProductsBySubject,
  type ErpProduct,
} from "@/lib/erpnext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS = [
  "Wedding Card",
  "Hindu Wedding Card",
  "Muslim Wedding Card",
  "Christian Wedding Card",
];

export const metadata: Metadata = {
  title: "Wedding Cards – Beyond Invitation",
  description:
    "Browse all wedding card designs available at Beyond Invitation, including Hindu, Muslim, Christian and general wedding invitation cards.",
};

export default async function WeddingCardPage() {
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject(SUBJECTS);
  } catch (error) {
    console.error("ERPNext Wedding Card fetch failed:", error);

    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from ERPNext.";
  }

  return (
    <main className="bg-white">
      <section className="border-b border-gold/20 bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
            Collection
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-maroon sm:text-4xl">
                Wedding Cards
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-light">
                Browse all Hindu, Muslim, Christian and general wedding card
                designs.
              </p>
            </div>

            {!errorMessage && (
              <p className="text-sm font-semibold text-carbon">
                {products.length}{" "}
                {products.length === 1 ? "Product" : "Products"}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">
              ERPNext Error
            </p>

            <h2 className="mt-2 font-serif text-2xl font-semibold text-red-900">
              Products could not be loaded
            </h2>

            <p className="mt-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-gold/20 bg-paper p-8 text-center">
            <h2 className="font-serif text-2xl font-semibold text-maroon">
              No wedding cards found
            </h2>

            <p className="mt-2 text-sm text-ink-light">
              ERPNext connected successfully, but no visible products were found
              with Subject set to Wedding Card, Hindu Wedding Card, Muslim
              Wedding Card or Christian Wedding Card.
            </p>
          </div>
        ) : (
          <FilterableProductGrid products={products} />
        )}
      </section>
    </main>
  );
}