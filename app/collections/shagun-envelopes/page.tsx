import type { Metadata } from "next";
import Link from "next/link";
import FilterableProductGrid from "@/components/FilterableProductGrid";
import { fetchErpProductsBySubject } from "@/lib/erpnext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Shagun Envelopes – Beyond Invitation",
  description:
    "Explore premium Shagun Envelopes from Beyond Invitation.",
};

export default async function ShagunEnvelopesPage() {
  let products = [];
  let errorMessage = "";

  try {
    products = await fetchErpProductsBySubject("Shagun Envelopes");
  } catch (error) {
    console.error("ERPNext Shagun Envelopes fetch failed:", error);
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch Shagun Envelopes from ERPNext.";
  }

  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-[2rem] border border-gold/25 bg-paper px-6 py-10 text-center shadow-sm sm:px-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-maroon">
            Premium Collection
          </p>

          <h1 className="font-serif text-4xl font-semibold text-carbon sm:text-5xl">
            Shagun Envelopes
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-ink-mid sm:text-base">
            Premium envelopes for weddings, gifting, festive celebrations, and
            special occasions.
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="rounded-full border border-gold/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-carbon transition hover:border-maroon hover:text-maroon"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <h2 className="mb-2 text-lg font-semibold">
              ERPNext connection problem
            </h2>
            <p className="text-sm">{errorMessage}</p>
            <p className="mt-3 text-sm">
              Please check ERPNext credentials, Item permissions, and whether
              the Subject field contains exactly{" "}
              <strong>Shagun Envelopes</strong>.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-gold/25 bg-paper p-8 text-center">
            <h2 className="font-serif text-2xl text-carbon">
              No Shagun Envelopes found
            </h2>
            <p className="mt-3 text-sm text-ink-mid">
              ERPNext connected successfully, but no visible products were found
              with Subject set to <strong>Shagun Envelopes</strong>.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm text-ink-mid">
                Showing{" "}
                <span className="font-semibold text-carbon">
                  {products.length}
                </span>{" "}
                Shagun Envelope products
              </p>
            </div>

            <FilterableProductGrid products={products} />
          </>
        )}
      </section>
    </main>
  );
}