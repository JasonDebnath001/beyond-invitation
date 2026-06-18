"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import { ProductGrid } from "./ProductGrid";

interface PriceRange {
  key: string;
  label: string;
  min: number;
  max: number;
}

const PRODUCTS_PER_LOAD = 10;

/**
 * Price buckets.
 * Edit this array to change the available ranges.
 */
const PRICE_RANGES: PriceRange[] = [
  { key: "all", label: "All Prices", min: 0, max: Infinity },
  { key: "under-100", label: "Under ₹100", min: 0, max: 100 },
  { key: "100-300", label: "₹100 – ₹300", min: 100, max: 300 },
  { key: "300-1000", label: "₹300 – ₹1000", min: 300, max: 1000 },
  { key: "above-1000", label: "Above ₹1000", min: 1000, max: Infinity },
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
  products: Product[];
}

export default function FilterableProductGrid({
  products,
}: FilterableProductGridProps) {
  const [priceKey, setPriceKey] = useState("all");
  const [sortKey, setSortKey] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_LOAD);

  const isFiltered = priceKey !== "all" || sortKey !== "featured";

  /**
   * Filtered + sorted list, recomputed only when inputs change.
   */
  const visibleProducts = useMemo(() => {
    const range =
      PRICE_RANGES.find((r) => r.key === priceKey) ?? PRICE_RANGES[0];

    let result = products.filter(
      (p) => p.price >= range.min && p.price < range.max,
    );

    switch (sortKey) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;

      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;

      case "discount":
        result = [...result].sort(
          (a, b) => discountPercent(b) - discountPercent(a),
        );
        break;

      default:
        break;
      // "featured" — keep original order
    }

    return result;
  }, [products, priceKey, sortKey]);

  /**
   * Reset visible products whenever filter/sort/product list changes.
   */
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_LOAD);
  }, [products, priceKey, sortKey]);

  const displayedProducts = useMemo(() => {
    return visibleProducts.slice(0, visibleCount);
  }, [visibleProducts, visibleCount]);

  const hasMoreProducts = visibleCount < visibleProducts.length;

  function clearFilters() {
    setPriceKey("all");
    setSortKey("featured");
    setVisibleCount(PRODUCTS_PER_LOAD);
  }

  function handleLoadMore() {
    setVisibleCount((currentCount) =>
      Math.min(currentCount + PRODUCTS_PER_LOAD, visibleProducts.length),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gold/20 bg-white/70 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Price</span>

          {PRICE_RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => setPriceKey(range.key)}
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

        <div className="flex items-center gap-2">
          <label htmlFor="sort-products" className="text-sm font-semibold text-ink">
            Sort
          </label>

          <select
            id="sort-products"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-lg border border-gold/30 bg-cream px-3 py-1.5 text-[13px] text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold"
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
          Showing{" "}
          <span className="font-semibold text-ink">
            {displayedProducts.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-ink">
            {visibleProducts.length}
          </span>{" "}
          {visibleProducts.length === 1 ? "product" : "products"}
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

      <ProductGrid products={displayedProducts} />

      {hasMoreProducts && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={handleLoadMore}
            className="rounded-full border border-maroon bg-maroon px-8 py-3 text-sm font-semibold text-gold-light shadow-sm transition hover:bg-maroon-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}