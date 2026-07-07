"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
      data-box-card
      className="group relative block overflow-hidden rounded-[1.65rem] border border-[#dcc184]/45 bg-[#fffaf1]/90 p-2.5 shadow-[0_18px_55px_rgba(47,27,13,0.10)] backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-[#c79d3f]/75 hover:shadow-[0_28px_80px_rgba(47,27,13,0.16)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
        <div className="absolute -left-20 top-10 h-36 w-36 rounded-full bg-[#c9a84c]/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-[#7b1c2e]/10 blur-3xl" />
      </div>

      <div className="relative overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_35%_18%,#fff8e8_0%,#f1dfbc_42%,#d4ad57_100%)]">
        <div className="aspect-[4/4.6]">
          {showImage ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.055]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#7b604d]">
                  Wedding Box
                </p>
                <p className="mt-3 text-4xl">✦</p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1f1209]/45 via-transparent to-white/10" />
        <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-white/45" />

        <div className="absolute left-3 top-3 rounded-full border border-white/45 bg-white/75 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a2715] shadow-sm backdrop-blur">
          Wedding Box
        </div>
      </div>

      <div className="relative px-1.5 pb-1.5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-2 text-base font-semibold leading-tight tracking-[-0.02em] text-[#2a1810] sm:text-lg">
            {product.name}
          </h2>

          <span className="shrink-0 rounded-full bg-[#2a1810] px-3 py-1 text-[11px] font-semibold text-[#f4d78e]">
            {formatPrice(product.price)}
          </span>
        </div>

        <p className="mt-2 line-clamp-1 text-xs text-[#806553] sm:text-sm">
          {detail || "Premium invitation presentation"}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-[#d9b875]/35 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]">
            View details
          </span>

          <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d9b875]/50 bg-white/70 text-[#2a1810] transition duration-300 group-hover:translate-x-1 group-hover:bg-[#2a1810] group-hover:text-[#f4d78e]">
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

  const featuredProduct = useMemo(() => products[0], [products]);

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
        const introItems = root.querySelectorAll("[data-intro]");
        const cards = root.querySelectorAll("[data-box-card]");
        const premiumLine = root.querySelector("[data-premium-line]");
        const softFloat = root.querySelectorAll("[data-soft-float]");
        const shimmer = root.querySelector("[data-shimmer]");

        if (reduceMotion) {
          gsap.set([introItems, cards, premiumLine, shimmer], {
            opacity: 1,
            y: 0,
            x: 0,
            scale: 1,
            filter: "blur(0px)",
          });
          return;
        }

        const tl = gsap.timeline({
          defaults: {
            ease: "power3.out",
          },
        });

        tl.fromTo(
          introItems,
          {
            opacity: 0,
            y: 18,
            filter: "blur(10px)",
          },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.75,
            stagger: 0.07,
          },
        )
          .fromTo(
            premiumLine,
            {
              scaleX: 0,
              opacity: 0,
              transformOrigin: "left center",
            },
            {
              scaleX: 1,
              opacity: 1,
              duration: 0.85,
            },
            "-=0.35",
          )
          .fromTo(
            cards,
            {
              opacity: 0,
              y: 24,
              scale: 0.975,
              filter: "blur(8px)",
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.72,
              stagger: 0.05,
            },
            "-=0.45",
          );

        gsap.to(softFloat, {
          y: -10,
          rotate: 1.2,
          duration: 4.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.25,
        });

        gsap.to(shimmer, {
          xPercent: 120,
          duration: 2.1,
          delay: 0.6,
          ease: "power2.inOut",
        });
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
      className="min-h-screen overflow-hidden bg-[#fff8ec] text-[#2a1810]"
    >
      <section className="relative isolate px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-20 lg:pt-12">
        <div className="pointer-events-none absolute left-[-18rem] top-[-18rem] h-[36rem] w-[36rem] rounded-full bg-[#c9a84c]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-18rem] right-[-18rem] h-[38rem] w-[38rem] rounded-full bg-[#7b1c2e]/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.68),rgba(255,248,236,0.16)_44%,rgba(217,184,117,0.14))]" />

        <div className="relative mx-auto grid max-w-7xl gap-7 lg:grid-cols-[345px_1fr] xl:grid-cols-[390px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-[2rem] border border-[#dcc184]/50 bg-white/55 p-6 shadow-[0_24px_80px_rgba(47,27,13,0.10)] backdrop-blur-xl sm:p-7">
              <nav
                data-intro
                aria-label="Breadcrumb"
                className="mb-7 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]"
              >
                <Link href="/" className="transition hover:text-[#2a1810]">
                  Home
                </Link>
                <span className="text-[#c9a84c]">/</span>
                <span>Wedding Boxes</span>
              </nav>

              <p
                data-intro
                className="mb-4 inline-flex rounded-full border border-[#c9a84c]/45 bg-[#fff8ec]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#7b1c2e]"
              >
                Premium collection
              </p>

              <h1
                data-intro
                className="text-4xl font-semibold leading-[0.95] tracking-[-0.06em] text-[#24130b] sm:text-5xl lg:text-6xl"
              >
                Wedding Boxes
              </h1>

              <p
                data-intro
                className="mt-5 max-w-sm text-sm leading-7 text-[#715746]"
              >
                Elegant boxes for invitations, keepsakes, and wedding gifting.
              </p>

              <div
                data-premium-line
                className="my-7 h-px w-full bg-gradient-to-r from-[#c9a84c] via-[#d9b875]/65 to-transparent"
              />

              {featuredProduct ? (
                <Link
                  data-intro
                  href={`/products/${featuredProduct.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-[#d9b875]/35 bg-[#2a1810] p-3 text-[#fff8ec] transition duration-300 hover:-translate-y-0.5 hover:bg-[#7b1c2e]"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f1dfbc]">
                    {getPrimaryImage(featuredProduct) ? (
                      <img
                        src={getPrimaryImage(featuredProduct)}
                        alt={featuredProduct.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[#2a1810]">
                        ✦
                      </div>
                    )}

                    <span
                      data-shimmer
                      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 rotate-12 bg-white/30 blur-md"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#f6d889]">
                      Featured
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm font-semibold">
                      {featuredProduct.name}
                    </p>
                  </div>
                </Link>
              ) : null}

              <Link
                data-intro
                href="/contact"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-[#2a1810]/15 bg-white/70 px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#2a1810] transition duration-300 hover:-translate-y-0.5 hover:border-[#7b1c2e]/40 hover:bg-white"
              >
                Custom enquiry
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            <div
              data-intro
              className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b1e2d]">
                  Curated collection
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#2a1810] sm:text-3xl">
                  Explore Wedding Boxes
                </h2>
              </div>

              <Link
                href="/contact"
                className="hidden rounded-full bg-[#2a1810] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#f6d889] transition duration-300 hover:-translate-y-0.5 hover:bg-[#7b1c2e] sm:inline-flex"
              >
                Bespoke box
              </Link>
            </div>

            {errorMessage ? (
              <div className="rounded-[2rem] border border-[#7b1c2e]/20 bg-white/70 p-8 text-center shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b1e2d]">
                  Something went wrong
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                  We couldn&apos;t load this collection
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                  Please refresh the page or contact us for available wedding
                  box designs.
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-[2rem] border border-[#d9b875]/40 bg-white/70 p-8 text-center shadow-sm backdrop-blur sm:p-10">
                <p className="text-5xl">✦</p>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                  Our wedding box collection is being refreshed
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                  Please check back soon, or send us a custom enquiry.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((product) => (
                  <WeddingBoxProductCard key={product.slug} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          data-soft-float
          className="pointer-events-none absolute right-[8%] top-10 hidden h-24 w-24 rounded-full border border-[#d9b875]/45 lg:block"
        />

        <div
          data-soft-float
          className="pointer-events-none absolute bottom-16 left-[6%] hidden h-16 w-16 rotate-45 border border-[#c9a84c]/35 lg:block"
        />
      </section>
    </main>
  );
}