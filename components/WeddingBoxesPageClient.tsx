"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

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
      className="group block overflow-hidden rounded-3xl border border-carbon/10 bg-white shadow-[0_10px_30px_rgba(123,28,46,0.06)] transition duration-500 hover:-translate-y-1.5 hover:border-carbon/25 hover:shadow-[0_22px_55px_rgba(123,28,46,0.14)] focus:outline-none focus:ring-2 focus:ring-carbon/20"
    >
      <div className="relative overflow-hidden bg-paper">
        <div className="aspect-[4/5]">
          {showImage ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-paper px-6 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-ink-mid">
                  Wedding Box
                </p>
                <p className="mt-4 text-5xl text-carbon">✦</p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-carbon/25 via-transparent to-transparent opacity-70" />

        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-carbon shadow-sm backdrop-blur">
          Wedding Box
        </span>

        <span className="absolute bottom-3 right-3 rounded-full bg-carbon px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
          {formatPrice(product.price)}
        </span>
      </div>

      <div className="p-4">
        <h2 className="line-clamp-2 text-[15px] font-extrabold leading-snug tracking-tight text-carbon">
          {product.name}
        </h2>

        {detail ? (
          <p className="mt-1.5 line-clamp-1 text-xs font-medium text-ink-light">
            {detail}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-carbon/10 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-carbon">
            View details
          </span>

          <span className="inline-block text-base leading-none text-gold transition duration-300 group-hover:translate-x-1">
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
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      const intro = root.querySelectorAll("[data-page-intro]");
      const title = root.querySelector("[data-page-title]");
      const rule = root.querySelector("[data-header-rule]");
      const cards = root.querySelectorAll("[data-wedding-box-card]");

      if (reduceMotion) {
        gsap.set([intro, title, cards], {
          opacity: 1,
          y: 0,
          clipPath: "inset(0% 0% 0% 0%)",
        });

        if (rule) {
          gsap.set(rule, { scaleX: 1 });
        }

        return;
      }

      /*
       * Opacity + position only.
       * No filter/blur animations: they force the browser to rasterize
       * the cards and leave images looking soft.
       */
      const timeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      timeline.fromTo(
        intro,
        {
          opacity: 0,
          y: 12,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.06,
        },
      );

      if (title) {
        timeline.fromTo(
          title,
          {
            opacity: 0,
            y: 26,
            clipPath: "inset(0% 0% 100% 0%)",
          },
          {
            opacity: 1,
            y: 0,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 0.8,
            ease: "power4.out",
          },
          "-=0.4",
        );
      }

      if (rule) {
        timeline.fromTo(
          rule,
          {
            scaleX: 0,
            transformOrigin: "left center",
          },
          {
            scaleX: 1,
            duration: 0.8,
            ease: "power3.inOut",
          },
          "-=0.55",
        );
      }

      timeline.fromTo(
        cards,
        {
          opacity: 0,
          y: 26,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: {
            each: 0.06,
            grid: "auto",
            from: "start",
          },
          /*
           * Remove GSAP's inline transform/opacity once the entrance
           * finishes so hover effects and image rendering are fully
           * handled by CSS, keeping images crisp.
           */
          clearProps: "transform,opacity",
        },
        "-=0.45",
      );
    }, root);

    return () => ctx.revert();
  }, [products.length]);

  return (
    <main
      ref={rootRef}
      data-no-text-motion
      className="min-h-screen bg-white text-carbon"
    >
      <section className="relative px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.14),transparent_38%),radial-gradient(circle_at_top_right,rgba(123,28,46,0.07),transparent_34%)]" />

        <div className="relative mx-auto max-w-[1500px]">
          {/*
            Compact header:
            breadcrumb + title + count + CTA in one slim band so the
            product grid is visible without scrolling.
          */}
          <nav
            data-page-intro
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink-light"
          >
            <Link href="/" className="text-carbon transition hover:text-maroon">
              Home
            </Link>
            <span className="text-gold">/</span>
            <span className="text-maroon">Wedding Boxes</span>
          </nav>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1
                data-page-title
                className="text-3xl font-extrabold leading-none tracking-tight text-carbon sm:text-4xl"
              >
                Wedding Boxes
              </h1>

              {!errorMessage && products.length > 0 ? (
                <span
                  data-page-intro
                  className="rounded-full bg-paper px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-carbon"
                >
                  {products.length}{" "}
                  {products.length === 1 ? "Design" : "Designs"}
                </span>
              ) : null}

              <p
                data-page-intro
                className="hidden text-sm font-medium text-ink-light md:block"
              >
                Elegant boxes for invitations, keepsakes and wedding gifting.
              </p>
            </div>

            <Link
              data-page-intro
              href="/contact"
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-carbon px-5 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-carbon-dark focus:outline-none focus:ring-2 focus:ring-carbon/25"
            >
              Custom enquiry
            </Link>
          </div>

          <div
            data-header-rule
            className="mt-4 h-px w-full bg-gradient-to-r from-carbon/25 via-gold/50 to-transparent"
          />

          <div className="mt-5">
            {errorMessage ? (
              <div className="rounded-3xl border border-carbon/10 bg-paper p-8 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-maroon">
                  Something went wrong
                </p>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-carbon sm:text-3xl">
                  We couldn&apos;t load this collection
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink-mid">
                  Please refresh the page or contact us for available wedding
                  box designs.
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-carbon/10 bg-paper p-8 text-center shadow-sm sm:p-10">
                <p className="text-5xl text-carbon">✦</p>
                <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-carbon sm:text-3xl">
                  Our wedding box collection is being refreshed
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink-mid">
                  There are no items with Subject set to Wedding Box and Show on
                  Website enabled right now. Please check back soon, or send us
                  a custom enquiry.
                </p>
                <Link
                  href="/contact"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-carbon px-6 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-carbon-dark"
                >
                  Custom enquiry
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                  <WeddingBoxProductCard key={product.slug} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
