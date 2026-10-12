"use client";

import type { CatalogBrowsePage, CatalogPrice, CatalogScope, CatalogSort } from "@/lib/catalog-browse-options";
import { useCatalogPagination } from "@/components/useCatalogPagination";
import { CatalogPaginationControls } from "@/components/PaginatedProductGrid";
import { ProductGrid } from "./ProductGrid";

interface PriceRange {
  key: CatalogPrice;
  label: string;
}

/**
 * Price buckets.
 * Edit this array to change the available ranges.
 */
const PRICE_RANGES: PriceRange[] = [
  { key: "all", label: "All Prices" },
  { key: "under-100", label: "Under ₹100" },
  { key: "100-300", label: "₹100 – ₹300" },
  { key: "300-1000", label: "₹300 – ₹1000" },
  { key: "above-1000", label: "Above ₹1000" },
];

/**
 * Sort options.
 */
const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "discount", label: "Biggest Discount" },
];

interface FilterableProductGridProps {
  initialPage: CatalogBrowsePage;
  scope?: CatalogScope;
}

export default function FilterableProductGrid({
  initialPage,
  scope = {},
}: FilterableProductGridProps) {
  const pagination = useCatalogPagination(initialPage, scope);
  const { page, price: priceKey, sort: sortKey, setPrice, setSort, clearFilters, loading, error } = pagination;
  const isFiltered = priceKey !== "all" || sortKey !== "featured";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gold/20 bg-white/70 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Price</span>

          {PRICE_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => setPrice(range.key)}
              aria-pressed={priceKey === range.key}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition ${
                priceKey === range.key
                  ? "border-maroon bg-maroon text-gold-light"
                  : "border-gold/30 bg-cream text-ink-mid hover:border-gold hover:bg-gold-pale"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
          <label htmlFor="sort-products" className="text-sm font-semibold text-ink">
            Sort
          </label>

          <select
            id="sort-products"
            value={sortKey}
            onChange={(e) => setSort(e.target.value as CatalogSort)}
            className="min-w-0 flex-1 rounded-lg border border-gold/30 bg-cream px-3 py-1.5 text-[13px] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold md:flex-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-mid" aria-live="polite">
          {loading === "replace" ? "Loading products…" : error && page.products.length === 0 ? "Products unavailable" : <>
          Showing{" "}
          <span className="font-semibold text-ink">
            {page.products.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-ink">
            {page.total}
          </span>{" "}
          {page.total === 1 ? "product" : "products"}
          </>}
        </p>

        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-maroon underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div aria-busy={Boolean(loading)}>
        {loading === "replace" ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="min-w-0 motion-safe:animate-pulse">
                <div className="aspect-square bg-neutral-100" />
                <div className="mt-2 h-4 w-4/5 bg-neutral-100" />
                <div className="mt-2 h-4 w-1/2 bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : !error || page.products.length > 0 ? <ProductGrid products={page.products} /> : null}
        <CatalogPaginationControls {...pagination} />
      </div>
    </div>
  );
}
