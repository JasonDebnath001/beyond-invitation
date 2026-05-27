import Link from "next/link";
import type { Product } from "@/types";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
}

/** A responsive grid of product cards. */
export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="py-12 text-center text-ink-light">
        No products found in this collection yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
  /** Apply the ivory background band */
  shaded?: boolean;
}

/** A full homepage section: heading + grid + optional "view all" link. */
export function ProductSection({
  label,
  title,
  products,
  viewAllHref,
  viewAllText = "View All",
  shaded = false,
}: ProductSectionProps) {
  return (
    <section className={shaded ? "bg-ivory py-16" : "py-16"}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-11 text-center">
          <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            {label}
          </span>
          <h2 className="font-display text-3xl font-semibold text-maroon-dark md:text-[38px]">
            {title}
          </h2>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gold/25" />
            <span className="text-sm text-gold">✦</span>
            <span className="h-px w-16 bg-gold/25" />
          </div>
        </div>

        <ProductGrid products={products} />

        {viewAllHref && (
          <div className="mt-9 text-center">
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-maroon px-7 py-2.5 text-[13.5px] font-medium text-maroon transition hover:bg-maroon hover:text-gold-light"
            >
              {viewAllText} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
