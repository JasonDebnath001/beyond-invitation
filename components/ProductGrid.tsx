"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types";
import type { ProductPage } from "@/lib/product-page";
import ProductCard from "./ProductCard";

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
    <div className="grid min-w-0 grid-cols-2 gap-2 min-[360px]:gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.slug}
          product={product}
          imageSizes="(min-width: 1280px) 212px, (min-width: 1024px) calc(25vw - 47px), (min-width: 768px) calc(33.333vw - 47px), (min-width: 640px) calc(50vw - 52px), calc(50vw - 36px)"
        />
      ))}
    </div>
  );
}

interface ProductSectionProps {
  label: string;
  title: string;
  products: Product[];
  nextOffset: number | null;
  sale?: boolean;
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
  nextOffset,
  sale = false,
  viewAllHref,
  viewAllText = "View All",
  shaded = false,
}: ProductSectionProps) {
  const [loadedProducts, setLoadedProducts] = useState(products);
  const [offset, setOffset] = useState(nextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLoadedProducts(products);
    setOffset(nextOffset);
    setLoading(false);
    setError("");
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [products, nextOffset]);

  const displayedProducts = useMemo(() => {
    if (!sale) return loadedProducts;
    return loadedProducts.map((product) => {
      const onSale = product.price > 0 && product.mrp > product.price;
      return { ...product, onSale, badge: onSale ? "SALE" : product.badge };
    });
  }, [loadedProducts, sale]);

  const hasMoreProducts = offset !== null;

  async function handleLoadMore() {
    if (offset === null || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/catalog/products?offset=${offset}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Product request failed");
      const page: ProductPage = await response.json();
      if (
        !Array.isArray(page.products) ||
        (page.nextOffset !== null &&
          (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset))
      ) {
        throw new Error("Invalid product page");
      }
      if (controller.signal.aborted) return;

      setLoadedProducts((current) => {
        const seen = new Set(current.map((product) => product.slug));
        return [
          ...current,
          ...page.products.filter((product) => {
            if (seen.has(product.slug)) return false;
            seen.add(product.slug);
            return true;
          }),
        ];
      });
      setOffset(page.nextOffset);
    } catch {
      if (!controller.signal.aborted) {
        setError("More products could not be loaded. Please try again.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section
      className={shaded ? "bg-cream/60 py-14 md:py-20" : "py-14 md:py-20"}
    >
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

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-maroon">
            {error}
          </p>
        )}
        <p role="status" className="sr-only">
          {loading
            ? "Loading more products"
            : `${displayedProducts.length} products shown`}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {hasMoreProducts && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading}
              className="rounded-full border border-maroon bg-maroon px-8 py-3 text-sm font-semibold text-gold-light shadow-sm transition hover:bg-maroon-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Loading..." : error ? "Try Again" : "Load More"}
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
