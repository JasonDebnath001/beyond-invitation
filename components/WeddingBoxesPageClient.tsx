"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowUpRight, Sparkles } from "lucide-react";

import type { ErpProduct } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

type WeddingBoxesPageClientProps = {
  products: ErpProduct[];
  errorMessage?: string;
};

function FloralMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 180"
      fill="none"
      className={className}
    >
      <circle cx="90" cy="90" r="64" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="90" cy="90" r="47" stroke="currentColor" strokeWidth="0.8" />
      {Array.from({ length: 12 }).map((_, index) => (
        <ellipse
          key={index}
          cx="90"
          cy="36"
          rx="8"
          ry="25"
          stroke="currentColor"
          strokeWidth="0.8"
          transform={`rotate(${index * 30} 90 90)`}
        />
      ))}
      <circle cx="90" cy="90" r="10" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="90" cy="90" r="3" fill="currentColor" />
    </svg>
  );
}

export default function WeddingBoxesPageClient({
  products,
  errorMessage = "",
}: WeddingBoxesPageClientProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      const rule = root.querySelector("[data-header-rule]");
      const cards = root.querySelectorAll("[data-wedding-box-card]");

      if (reduceMotion) {
        gsap.set(cards, {
          opacity: 1,
          y: 0,
        });
        if (rule) gsap.set(rule, { scaleX: 1 });
        return;
      }

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline.fromTo(
        cards,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: { each: 0.045, grid: "auto", from: "start" },
          clearProps: "transform,opacity",
        },
      );

      if (rule) {
        gsap.fromTo(
          rule,
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 0.9, ease: "power3.inOut" },
        );
      }
    }, root);

    return () => ctx.revert();
  }, [products.length]);

  const hasProducts = !errorMessage && products.length > 0;

  return (
    <div
      ref={rootRef}
      data-wedding-boxes-page
      data-no-text-motion
      className="min-h-screen overflow-x-clip bg-[#fbf6ee] text-[#351119]"
    >
      <section
        id="wedding-box-collection"
        className="relative scroll-mt-24 px-3 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
      >
        <div className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-[#dcb162]/10 blur-3xl" />
        <div className="relative mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.26em] text-[#a7772d] sm:text-[11px]">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                Curated with intention
              </p>
              <h2 className="mt-3 max-w-2xl text-[30px] font-light leading-tight tracking-[-0.035em] text-[#50101f] sm:text-4xl lg:text-[48px]">
                The wedding box collection
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#76635a] sm:text-[15px]">
                From ornate keepsake boxes to refined invitation presentations,
                discover a design worthy of your first impression.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {hasProducts ? (
                <span className="rounded-full border border-[#a7772d]/25 bg-white/70 px-4 py-2 text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#64172a] shadow-sm sm:text-[10px]">
                  {products.length}{" "}
                  {products.length === 1 ? "design" : "designs"}
                </span>
              ) : null}
            </div>
          </div>

          <div
            data-header-rule
            className="mt-7 h-px w-full bg-gradient-to-r from-[#a7772d]/55 via-[#64172a]/16 to-transparent sm:mt-9"
          />

          <div className="mt-6 sm:mt-8">
            {errorMessage ? (
              <div className="rounded-[28px] border border-[#a7772d]/20 bg-white px-6 py-12 text-center shadow-[0_18px_55px_rgba(73,25,31,0.06)] sm:px-10 sm:py-16">
                <FloralMark className="mx-auto h-20 w-20 text-[#a7772d]/45" />
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#a7772d]">
                  The collection is resting
                </p>
                <h2 className="mt-3 text-2xl font-light tracking-tight text-[#50101f] sm:text-3xl">
                  We couldn&apos;t load these designs just now
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#76635a]">
                  Please refresh the page, or speak with our team to explore the
                  latest wedding box designs and custom finishes.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#64172a] px-6 text-[10px] font-bold uppercase tracking-[0.17em] text-white transition hover:bg-[#45101d]"
                >
                  Speak with our team
                </Link>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-[28px] border border-[#a7772d]/20 bg-white px-6 py-12 text-center shadow-[0_18px_55px_rgba(73,25,31,0.06)] sm:px-10 sm:py-16">
                <FloralMark className="mx-auto h-20 w-20 text-[#a7772d]/45" />
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#a7772d]">
                  A new edit is arriving
                </p>
                <h2 className="mt-3 text-2xl font-light tracking-tight text-[#50101f] sm:text-3xl">
                  Our wedding box collection is being refreshed
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#76635a]">
                  In the meantime, our design team would be delighted to create
                  a personalised wedding box around your story.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#64172a] px-6 text-[10px] font-bold uppercase tracking-[0.17em] text-white transition hover:bg-[#45101d]"
                >
                  Start a custom enquiry
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:gap-7">
                {products.map((product) => (
                  <div key={product.slug} data-wedding-box-card className="min-w-0">
                    <ProductCard product={product} categoryLabel="Wedding box" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-3 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <div className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[30px] bg-[#541122] px-6 py-10 text-white shadow-[0_26px_70px_rgba(74,18,34,0.18)] sm:rounded-[40px] sm:px-10 sm:py-12 lg:px-16 lg:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(231,189,107,0.2),transparent_28%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.025)_60%,transparent_100%)]" />
          <FloralMark className="pointer-events-none absolute -right-14 -top-20 h-72 w-72 text-[#efcb82]/15" />
          <div className="relative flex min-w-0 flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#efcb82] sm:text-[10px]">
                The bespoke atelier
              </p>
              <h2 className="mt-3 text-[28px] font-light leading-tight tracking-[-0.03em] text-[#fffaf0] sm:text-4xl">
                Have a wedding story only you can tell?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                We can personalise the colour, artwork, names, inserts and
                finishing details to create a box that feels entirely yours.
              </p>
            </div>
            <Link
              href="/contact"
              className="group inline-flex min-h-12 w-full max-w-full shrink-0 items-center justify-center self-start rounded-full bg-[#e7bd6b] px-4 py-3 text-center text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#40101b] transition hover:-translate-y-0.5 hover:bg-[#f2d796] sm:w-auto sm:px-7 sm:text-[10px] sm:tracking-[0.17em] lg:self-auto"
            >
              <span>Create something bespoke</span>
              <ArrowUpRight className="ml-2 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
