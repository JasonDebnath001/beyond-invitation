"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ErpProduct } from "@/lib/erpnext";

type WeddingBoxesPageClientProps = {
  products: ErpProduct[];
  errorMessage?: string;
};

function formatPrice(price: number) {
  if (!price || price <= 0) {
    return "Price on request";
  }

  return `₹${price.toLocaleString("en-IN")}`;
}

function getImageSrc(image?: string) {
  if (!image) return "";

  const value = image.trim();
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/files/") || value.startsWith("/private/files/")) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");
    return erpUrl ? `${erpUrl}${value}` : value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/products/${value}`;
}

function stripHtml(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrimaryImage(product: ErpProduct) {
  const images = Array.from(
    new Set(
      (product.images ?? [])
        .map((image) => image?.trim())
        .filter((image): image is string => Boolean(image)),
    ),
  );

  return getImageSrc(images[0]);
}

function WeddingBoxProductCard({ product }: { product: ErpProduct }) {
  const [imageFailed, setImageFailed] = useState(false);

  const image = getPrimaryImage(product);
  const showImage = Boolean(image && !imageFailed);

  const detail =
    stripHtml(product.material) ||
    stripHtml(product.includes) ||
    stripHtml(product.customisation);

  return (
    <Link
      href={`/products/${product.slug}`}
      data-wedding-box-card
      className="group block overflow-hidden rounded-[1.75rem] border border-[#e4d2a5] bg-[#fffaf1] shadow-[0_18px_50px_rgba(49,28,13,0.09)] transition duration-500 hover:-translate-y-1 hover:border-[#c8a75d] hover:shadow-[0_26px_70px_rgba(49,28,13,0.15)]"
    >
      <div className="relative overflow-hidden bg-[#f1dfbd]">
        <div className="aspect-[4/5]">
          {showImage ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#f4e5c8] px-6 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7b604d]">
                  Wedding Box
                </p>
                <p className="mt-4 text-5xl text-[#7b1c2e]">✦</p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80" />

        <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a2715] shadow-sm backdrop-blur">
          Wedding Box
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.025em] text-[#2a1810]">
            {product.name}
          </h2>

          <span className="shrink-0 rounded-full bg-[#2a1810] px-3.5 py-1.5 text-xs font-semibold text-[#f6d889]">
            {formatPrice(product.price)}
          </span>
        </div>

        {detail ? (
          <p className="mt-3 line-clamp-1 text-sm text-[#806553]">{detail}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-[#e4d2a5] pt-4">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7b1c2e]">
            View details
          </span>

          <span className="text-lg text-[#2a1810] transition duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function WeddingBoxesPageClient({
  products,
  errorMessage = "",
}: WeddingBoxesPageClientProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const gsapModule = await import("gsap");

      if (!mounted) return;

      const gsap = gsapModule.gsap;
      const root = rootRef.current;

      if (!root) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const ctx = gsap.context(() => {
        const introItems = root.querySelectorAll("[data-page-intro]");
        const cards = root.querySelectorAll("[data-wedding-box-card]");

        if (reduceMotion) {
          gsap.set([introItems, cards], {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
          });
          return;
        }

        gsap
          .timeline({
            defaults: {
              ease: "power3.out",
            },
          })
          .fromTo(
            introItems,
            {
              opacity: 0,
              y: 16,
              filter: "blur(8px)",
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.7,
              stagger: 0.07,
            },
          )
          .fromTo(
            cards,
            {
              opacity: 0,
              y: 28,
              filter: "blur(8px)",
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.75,
              stagger: 0.07,
            },
            "-=0.35",
          );
      }, root);

      cleanup = () => ctx.revert();
    }

    runAnimation();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [products.length]);

  return (
    <main
      ref={rootRef}
      data-no-text-motion
      className="min-h-screen bg-[#fff8ec] text-[#2a1810]"
    >
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.2),transparent_34%),radial-gradient(circle_at_top_right,rgba(123,28,46,0.09),transparent_32%)]" />

        <div className="relative mx-auto max-w-7xl">
          <nav
            data-page-intro
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]"
          >
            <Link href="/" className="transition hover:text-[#2a1810]">
              Home
            </Link>
            <span className="text-[#c9a84c]">/</span>
            <span>Wedding Boxes</span>
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
                className="text-4xl font-semibold leading-none tracking-[-0.055em] text-[#24130b] sm:text-5xl md:text-6xl"
              >
                Wedding Boxes
              </h1>

              <p
                data-page-intro
                className="mt-4 max-w-xl text-sm leading-7 text-[#715746] sm:text-base"
              >
                Elegant boxes for invitations, keepsakes, and wedding gifting.
              </p>
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
            <div className="rounded-[1.75rem] border border-[#e4d2a5] bg-white/70 p-8 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b1e2d]">
                Something went wrong
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                We couldn&apos;t load this collection
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                Please refresh the page or contact us for available wedding box
                designs.
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[1.75rem] border border-[#e4d2a5] bg-white/70 p-8 text-center shadow-sm sm:p-10">
              <p className="text-5xl text-[#7b1c2e]">✦</p>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                Our wedding box collection is being refreshed
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                Please check back soon, or send us a custom enquiry.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <WeddingBoxProductCard key={product.slug} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}