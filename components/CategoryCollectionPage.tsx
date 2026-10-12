"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { ProductCategory } from "@/types";
import type { CatalogBrowsePage } from "@/lib/catalog-browse-options";
import PaginatedProductGrid from "@/components/PaginatedProductGrid";

type CategoryCollectionPageClientProps = {
  categoryName: string;
  categoryDescription?: string;
  initialPage: CatalogBrowsePage;
  category: ProductCategory;
  errorMessage?: string;
};

export default function CategoryCollectionPageClient({
  categoryName,
  categoryDescription = "",
  initialPage,
  category,
  errorMessage = "",
}: CategoryCollectionPageClientProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      try {
        const gsapModule = await import("gsap");

        if (!mounted) return;

        const gsap = gsapModule.gsap;
        const root = rootRef.current;

        if (!root) return;

        const ctx = gsap.context(() => {
          const introItems = root.querySelectorAll("[data-page-intro]");
          // Products remain visible immediately, including newly appended pages.
          gsap.fromTo(introItems, { y: 10 }, {
            y: 0,
            duration: 0.3,
            ease: "power2.out",
            clearProps: "transform",
          });
        }, root);

        cleanup = () => ctx.revert();
      } catch (error) {
        console.warn("Category collection animation failed:", error);
      }
    }

    runAnimation();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return (
    <main
      ref={rootRef}
      data-no-text-motion
      className="min-h-screen bg-white text-[#2a1810]"
    >
      <section className="relative mx-auto max-w-[1800px] overflow-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(123,28,46,0.09),transparent_32%)]" />

        <div className="relative">
          <nav
            data-page-intro
            aria-label="Breadcrumb"
            className="mb-5 flex min-w-0 items-center gap-2 overflow-hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b1e2d] sm:tracking-[0.22em]"
          >
            <Link href="/" className="transition hover:text-[#2a1810]">
              Home
            </Link>
            <span className="text-[#c9a84c]">/</span>
            <span className="min-w-0 truncate">{categoryName}</span>
          </nav>

          <div className="mb-8 flex flex-col justify-between gap-5 border-b border-[#e3cca0] pb-7 md:flex-row md:items-end">
            <div>
              <p
                data-page-intro
                className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#7b1c2e]"
              >
                Premium collection
              </p>

              <h1
                data-page-intro
                className="break-words text-3xl font-semibold leading-none tracking-[-0.045em] text-[#24130b] min-[400px]:text-4xl sm:text-5xl sm:tracking-[-0.055em] md:text-6xl"
              >
                {categoryName}
              </h1>

              {categoryDescription ? (
                <p
                  data-page-intro
                  className="mt-4 max-w-xl text-sm leading-7 text-[#715746] sm:text-base"
                >
                  {categoryDescription}
                </p>
              ) : null}
            </div>

            <Link
              data-page-intro
              href="/contact"
              className="inline-flex w-fit items-center justify-center rounded-full bg-[#2a1810] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#f6d889] transition duration-300 hover:-translate-y-0.5 hover:bg-[#7b1c2e]"
            >
              Custom enquiry
            </Link>
          </div>

          {errorMessage ? (
            <div className="rounded-[1.75rem] border border-[#e4d2a5] bg-white/70 p-6 text-center shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b1e2d]">
                Something went wrong
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#2a1810] sm:text-3xl">
                We couldn&apos;t load this collection
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                Please refresh the page or contact us for available designs.
              </p>
            </div>
          ) : initialPage.products.length === 0 ? (
            <div className="rounded-[1.75rem] border border-[#e4d2a5] bg-white/70 p-6 text-center shadow-sm sm:p-10">
              <p className="text-5xl text-[#7b1c2e]">✦</p>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#2a1810] sm:text-3xl">
                This collection is being refreshed
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                Please check back soon, or send us a custom enquiry.
              </p>
            </div>
          ) : (
            <PaginatedProductGrid initialPage={initialPage} scope={{ category }} categoryLabel={categoryName} />
          )}
        </div>
      </section>
    </main>
  );
}
