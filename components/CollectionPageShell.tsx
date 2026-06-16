import Link from "next/link";

import FilterableProductGrid from "@/components/FilterableProductGrid";
import type { ErpProduct } from "@/lib/erpnext";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type CollectionPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  products: ErpProduct[];
  errorMessage?: string;
  emptyTitle: string;
  emptyDescription: string;
  subjectLabel: string;
  breadcrumb: BreadcrumbItem[];
  accentIcon?: string;
};

export default function CollectionPageShell({
  eyebrow = "Collection",
  title,
  description,
  products,
  errorMessage = "",
  emptyTitle,
  emptyDescription,
  subjectLabel,
  breadcrumb,
  accentIcon = "✦",
}: CollectionPageShellProps) {
  return (
    <main className="bg-white">
      <section className="border-b border-gold/20 bg-gradient-to-br from-paper via-white to-[#fff8f2]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-light">
            {breadcrumb.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-center gap-2">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="font-medium text-carbon transition hover:text-maroon"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-maroon">{item.label}</span>
                )}

                {index < breadcrumb.length - 1 && (
                  <span className="text-gold">/</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-base shadow-sm ring-1 ring-gold/20">
                  {accentIcon}
                </span>

                <span className="rounded-full bg-maroon/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
                  {eyebrow}
                </span>
              </div>

              <h1 className="font-serif text-3xl font-semibold leading-tight text-maroon sm:text-4xl">
                {title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-light">
                {description}
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-gold/20 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <div className="h-9 w-px bg-gold/30" />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Showing
                </p>
                <p className="text-sm font-semibold text-carbon">
                  {products.length}{" "}
                  {products.length === 1 ? "Product" : "Products"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">
              ERPNext Connection Problem
            </p>

            <h2 className="mt-2 font-serif text-2xl font-semibold text-red-900">
              Couldn&apos;t load this collection
            </h2>

            <p className="mt-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>

            <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm leading-6 text-red-700">
              Please check ERPNext credentials, Item permissions, Item Price
              permissions, and whether the Subject field contains exactly{" "}
              <span className="font-semibold">{subjectLabel}</span>.
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-gold/20 bg-paper/60 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-gold/20">
              {accentIcon}
            </div>

            <h2 className="mt-4 font-serif text-2xl font-semibold text-maroon">
              {emptyTitle}
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-light">
              {emptyDescription}
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                  Browse Designs
                </p>

                <h2 className="mt-1 font-serif text-2xl font-semibold text-carbon">
                  Choose your favourite design
                </h2>
              </div>
            </div>

            <FilterableProductGrid products={products} />
          </>
        )}
      </section>
    </main>
  );
}