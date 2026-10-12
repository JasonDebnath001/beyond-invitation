"use client";

import ProductCard from "@/components/ProductCard";
import { useCatalogPagination } from "@/components/useCatalogPagination";
import type { CatalogBrowsePage, CatalogScope } from "@/lib/catalog-browse-options";

type Pagination = ReturnType<typeof useCatalogPagination>;

export function CatalogPaginationControls({ page, loading, error, loadMore, retry }: Pick<Pagination, "page" | "loading" | "error" | "loadMore" | "retry">) {
  return (
    <div className="space-y-3 pt-4 text-center">
      {error && (
        <div role="alert" className="text-sm text-maroon">
          <p>{error}</p>
          <button type="button" onClick={retry} disabled={Boolean(loading)} className="mt-2 font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {page.nextOffset !== null && !error && (
        <button
          type="button"
          onClick={loadMore}
          disabled={Boolean(loading)}
          className="rounded-full border border-maroon bg-maroon px-8 py-3 text-sm font-semibold text-gold-light shadow-sm transition hover:bg-maroon-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load More"}
        </button>
      )}
    </div>
  );
}

export default function PaginatedProductGrid({ initialPage, scope = {}, categoryLabel, gridClassName = "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4" }: {
  initialPage: CatalogBrowsePage;
  scope?: CatalogScope;
  categoryLabel?: string;
  gridClassName?: string;
}) {
  const pagination = useCatalogPagination(initialPage, scope);
  return (
    <div aria-busy={Boolean(pagination.loading)}>
      <p className="mb-5 text-sm text-ink-mid" aria-live="polite">
        Showing {pagination.page.products.length} of {pagination.page.total} {pagination.page.total === 1 ? "product" : "products"}
      </p>
      <div className={gridClassName}>
        {pagination.page.products.map((product) => (
          <div key={product.slug} className="min-w-0">
            <ProductCard
              product={product}
              categoryLabel={categoryLabel}
              imageSizes="(min-width: 1800px) 419px, (min-width: 1024px) calc(25vw - 31px), (min-width: 768px) calc(33.333vw - 29.333px), (min-width: 640px) calc(50vw - 34px), calc(50vw - 22px)"
            />
          </div>
        ))}
      </div>
      <CatalogPaginationControls {...pagination} />
    </div>
  );
}
