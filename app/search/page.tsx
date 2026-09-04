import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts } from "@/lib/products";
import { ProductGrid } from "@/components/ProductGrid";

// Next.js 15: searchParams is a Promise and must be awaited.
interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export const metadata: Metadata = {
  title: "Search – Beyond Invitation",
  description: "Search wedding invitation cards and stationery at Beyond Invitation.",
  robots: {
    index: false,
    follow: true,
  },
};

/**
 * Full search results page at /search?q=...
 * A server component — reads the query from the URL and renders results
 * server-side, so the page is shareable and SEO-friendly.
 */
export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchProducts(query) : [];

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-gold">
          Search Results
        </p>
        {query ? (
          <h1 className="mt-1 break-words font-display text-2xl font-semibold text-maroon-dark [overflow-wrap:anywhere] sm:text-3xl">
            {results.length} {results.length === 1 ? "result" : "results"} for
            &ldquo;{query}&rdquo;
          </h1>
        ) : (
          <h1 className="mt-1 break-words font-display text-2xl font-semibold text-maroon-dark sm:text-3xl">
            Search our cards
          </h1>
        )}
      </div>

      {!query && (
        <p className="text-ink-mid">
          Type a card name, colour or theme in the search box above to find
          what you&apos;re looking for.
        </p>
      )}

      {query && results.length === 0 && (
        <div className="rounded-xl border border-gold/25 bg-white px-4 py-12 text-center sm:py-16">
          <div className="text-5xl">🔍</div>
          <p className="mt-4 break-words text-[15px] font-medium text-ink [overflow-wrap:anywhere]">
            No products matched &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-[13px] text-ink-light">
            Try a different keyword, or browse our full collection.
          </p>
          <Link
            href="/collections/wedding"
            className="mt-5 inline-flex max-w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-maroon px-4 py-2.5 text-center text-[13.5px] font-medium text-maroon transition hover:bg-maroon hover:text-gold-light sm:px-6"
          >
            Browse Wedding Cards →
          </Link>
        </div>
      )}

      {query && results.length > 0 && <ProductGrid products={results} />}
    </div>
  );
}
