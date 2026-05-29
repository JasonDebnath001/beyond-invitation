import Link from "next/link";
import type { Metadata } from "next";
import { fetchErpProductsBySubject, type ErpProduct } from "@/lib/erpnext";
import FilterableProductGrid from "@/components/FilterableProductGrid";

// Always fetch fresh from ERPNext so newly tagged items appear immediately.
export const dynamic = "force-dynamic";

// The ERPNext "Subject" value that identifies this collection.
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
    <main className="bg-white">
      {/* ── Premium header band ─────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-gold/20 bg-paper">
        {/* faint decorative monogram */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 select-none font-display text-[220px] leading-none text-gold/10 md:block"
        >
          ✦
        </span>

        <div className="relative mx-auto max-w-7xl px-6 py-16 text-center md:py-20">
          {/* breadcrumb */}
          <nav className="mb-6 text-[12px] tracking-wide text-ink-light">
            <Link href="/" className="transition-colors hover:text-maroon">
              Home
            </Link>
            <span className="mx-2 text-gold">/</span>
            <Link
              href="/collections/wedding-card"
              className="transition-colors hover:text-maroon"
            >
              Wedding Card
            </Link>
            <span className="mx-2 text-gold">/</span>
            <span className="text-ink">Christian</span>
          </nav>

          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-gold">
            The Wedding Card Collection
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-maroon-dark md:text-[52px]">
            Christian Wedding Cards
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-mid">
            Graceful florals, classic typography and refined craftsmanship —
            invitations thoughtfully designed to announce the church ceremony
            and reception with timeless elegance.
          </p>

          <div className="mt-7 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gold/40" />
            <span className="text-gold">✦</span>
            <span className="h-px w-16 bg-gold/40" />
          </div>
        </div>
      </section>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-14">
        {errorMessage ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-7 text-red-700">
            <h2 className="font-display text-xl font-semibold">
              Couldn&apos;t load this collection
            </h2>
            <p className="mt-2 text-[14px] leading-6">{errorMessage}</p>
            <div className="mt-4 rounded-xl bg-white p-4 text-[13px] leading-6 text-red-800">
              <p className="font-semibold">Please check:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  The <code>Subject</code> field name is correct — set{" "}
                  <code>ERPNEXT_SUBJECT_FIELD</code> in <code>.env.local</code>{" "}
                  if it isn&apos;t <code>custom_subject</code>.
                </li>
                <li>ERPNEXT_URL, API key and secret are valid.</li>
                <li>The API user can read Item and Item Price.</li>
              </ul>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-gold/30 bg-paper py-16 text-center">
            <div className="text-5xl">⛪</div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-maroon-dark">
              No Christian cards just yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-ink-mid">
              There are no items with Subject set to &ldquo;Christian&rdquo; and
              &ldquo;Show on Website&rdquo; enabled in ERPNext right now. Once
              they&apos;re tagged, they&apos;ll appear here automatically.
            </p>
            <Link
              href="/collections/wedding-card"
              className="mt-6 inline-flex items-center gap-2 border border-maroon px-7 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-maroon transition hover:bg-maroon hover:text-gold-light"
            >
              Browse Wedding Cards &#8594;
            </Link>
          </div>
        ) : (
          <FilterableProductGrid products={products} />
        )}
      </div>
    </main>
  );
}