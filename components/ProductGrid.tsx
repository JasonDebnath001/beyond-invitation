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
      <p className="border border-dashed border-neutral-200 py-16 text-center text-[14px] text-neutral-400">
        No products found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
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
    <section className={`py-20 md:py-24 ${shaded ? "bg-paper" : "bg-white"}`}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              {label}
            </span>
            <h2 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-[-0.01em] text-carbon md:text-[42px]">
              {title}
            </h2>
            <div className="mt-5 h-px w-14 bg-carbon" />
          </div>

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="group hidden shrink-0 items-center gap-2 border-b border-carbon pb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon sm:inline-flex"
            >
              {viewAllText}
              <span className="transition-transform group-hover:translate-x-1">
                &#8594;
              </span>
            </Link>
          )}
        </div>

        <ProductGrid products={products} />

        {viewAllHref && (
          <div className="mt-12 text-center sm:hidden">
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-2 border border-carbon px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon transition hover:bg-carbon hover:text-white"
            >
              {viewAllText} &#8594;
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}