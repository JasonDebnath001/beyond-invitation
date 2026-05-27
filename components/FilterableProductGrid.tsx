"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import { ProductGrid } from "./ProductGrid";

/*
 * Client component: handles price filtering + sorting for a list of products.
 * The collection page stays a server component and just passes products in —
 * all interactive state lives here.
 */

interface PriceRange {
    key: string;
    label: string;
    min: number;
    max: number;
}

/** Price buckets. Edit this array to change the available ranges. */
const PRICE_RANGES: PriceRange[] = [
    { key: "all", label: "All Prices", min: 0, max: Infinity },
    { key: "under-100", label: "Under ₹100", min: 0, max: 100 },
    { key: "100-300", label: "₹100 – ₹300", min: 100, max: 300 },
    { key: "300-1000", label: "₹300 – ₹1000", min: 300, max: 1000 },
    { key: "above-1000", label: "Above ₹1000", min: 1000, max: Infinity },
];

/** Sort options. */
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

    const isFiltered = priceKey !== "all" || sortKey !== "featured";

    /** Filtered + sorted list, recomputed only when inputs change. */
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
                break; // "featured" — keep original order
        }

        return result;
    }, [products, priceKey, sortKey]);

    function clearFilters() {
        setPriceKey("all");
        setSortKey("featured");
    }

    return (
        <div>
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gold/25 bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[12px] font-semibold uppercase tracking-wide text-ink-light">
                        Price
                    </span>
                    {PRICE_RANGES.map((range) => (
                        <button
                            key={range.key}
                            type="button"
                            onClick={() => setPriceKey(range.key)}
                            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition ${priceKey === range.key
                                    ? "border-maroon bg-maroon text-gold-light"
                                    : "border-gold/30 bg-cream text-ink-mid hover:border-gold hover:bg-gold-pale"
                                }`}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="sort"
                        className="text-[12px] font-semibold uppercase tracking-wide text-ink-light"
                    >
                        Sort
                    </label>
                    <select
                        id="sort"
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

            <div className="mb-6 flex items-center gap-3">
                <p className="text-[13px] text-ink-light">
                    {visibleProducts.length}{" "}
                    {visibleProducts.length === 1 ? "product" : "products"}
                </p>
                {isFiltered && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[13px] font-medium text-maroon underline-offset-2 hover:underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            <ProductGrid products={visibleProducts} />
        </div>
    );
}