"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/types";
import ProductCard from "./ProductCard";

const PRODUCTS_PER_LOAD = 10;

interface ProductGridProps {
  products: Product[];
}

/** A responsive grid of product cards. */
export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-mid">
        No products found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}

interface ProductSectionProps {
  label: string;
  title: string;
  products: Product[];
  viewAllHref?: string;
  viewAllText?: string;

  /** Apply the soft off-white background band */
  shaded?: boolean;
}

/** A full homepage section: heading + grid + optional load more + view all link. */
export function ProductSection({
  label,
  title,
  products,
  viewAllHref,
  viewAllText = "View All",
  shaded = false,
}: ProductSectionProps) {
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_LOAD);

  const displayedProducts = useMemo(() => {
    return products.slice(0, visibleCount);
  }, [products, visibleCount]);

  const hasMoreProducts = visibleCount < products.length;

  function handleLoadMore() {
    setVisibleCount((currentCount) =>
      Math.min(currentCount + PRODUCTS_PER_LOAD, products.length),
    );
  }

  return (
    <section className={shaded ? "bg-cream/60 py-14 md:py-20" : "py-14 md:py-20"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
              {label}
            </p>

            <h2 className="font-serif text-3xl font-semibold text-ink md:text-4xl">
              {title}
            </h2>
          </div>

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="hidden text-sm font-semibold text-maroon underline-offset-4 hover:underline md:inline-flex"
            >
              {viewAllText} →
            </Link>
          )}
        </div>

        <ProductGrid products={displayedProducts} />

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {hasMoreProducts && (
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-full border border-maroon bg-maroon px-8 py-3 text-sm font-semibold text-gold-light shadow-sm transition hover:bg-maroon-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
            >
              Load More
            </button>
          )}

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-sm font-semibold text-maroon underline-offset-4 hover:underline md:hidden"
            >
              {viewAllText} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}