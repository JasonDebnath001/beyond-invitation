"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ErpProduct } from "@/lib/erpnext";

type WeddingBoxesPageClientProps = {
  products: ErpProduct[];
  errorMessage?: string;
  subjectLabel: string;
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

  const tinyDetail =
    stripHtml(product.material) ||
    stripHtml(product.includes) ||
    stripHtml(product.customisation);

  return (
    <Link
      href={`/products/${product.slug}`}
      data-box-card
      className="group relative block overflow-hidden rounded-[2rem] border border-[#d9b875]/35 bg-[#fffaf0]/85 p-3 shadow-[0_24px_80px_rgba(41,22,10,0.10)] backdrop-blur transition duration-500 hover:-translate-y-1 hover:border-[#c9a84c]/70 hover:shadow-[0_34px_100px_rgba(41,22,10,0.16)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
        <div className="absolute -left-24 top-10 h-40 w-40 rounded-full bg-[#c9a84c]/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-44 w-44 rounded-full bg-[#7b1c2e]/10 blur-3xl" />
      </div>

      <div className="relative overflow-hidden rounded-[1.55rem] bg-[radial-gradient(circle_at_35%_18%,#fff8e8_0%,#f1dfbc_42%,#d4ad57_100%)]">
        <div className="aspect-[4/5]">
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
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7b604d]">
                  Wedding Box
                </p>
                <p className="mt-3 text-4xl">✦</p>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1f1209]/50 via-transparent to-white/10" />
        <div className="pointer-events-none absolute inset-0 rounded-[1.55rem] ring-1 ring-inset ring-white/45" />

        <div className="absolute left-4 top-4 rounded-full border border-white/40 bg-white/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#4a2715] shadow-sm backdrop-blur">
          Wedding Box
        </div>
      </div>

      <div className="relative px-2 pb-2 pt-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="line-clamp-2 text-xl font-semibold leading-tight tracking-[-0.02em] text-[#2a1810]">
            {product.name}
          </h2>

          <span className="shrink-0 rounded-full bg-[#2a1810] px-3 py-1 text-xs font-semibold text-[#f4d78e]">
            {formatPrice(product.price)}
          </span>
        </div>

        {tinyDetail ? (
          <p className="mt-3 line-clamp-1 text-sm text-[#806553]">{tinyDetail}</p>
        ) : (
          <p className="mt-3 text-sm text-[#806553]">Premium invitation presentation</p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-[#d9b875]/30 pt-4">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]">
            View box
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#d9b875]/50 bg-white/70 text-[#2a1810] transition duration-300 group-hover:translate-x-1 group-hover:bg-[#2a1810] group-hover:text-[#f4d78e]">
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
  subjectLabel,
}: WeddingBoxesPageClientProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  const heroImages = useMemo(() => {
    const images = products
      .map((product) => getPrimaryImage(product))
      .filter(Boolean)
      .slice(0, 3);

    return [
      images[0] ?? "",
      images[1] ?? "",
      images[2] ?? "",
    ];
  }, [products]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;

      gsap.registerPlugin(ScrollTrigger);

      const root = rootRef.current;
      if (!root) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const ctx = gsap.context(() => {
        const heroReveal = root.querySelectorAll("[data-hero-reveal]");
        const heroImages = root.querySelectorAll("[data-hero-image]");
        const cards = root.querySelectorAll("[data-box-card]");
        const floatItems = root.querySelectorAll("[data-float]");
        const glowItems = root.querySelectorAll("[data-glow]");
        const line = root.querySelector("[data-gold-line]");

        if (reduceMotion) {
          gsap.set([heroReveal, heroImages, cards, line], {
            opacity: 1,
            y: 0,
            x: 0,
            scale: 1,
            rotate: 0,
            filter: "blur(0px)",
            clipPath: "inset(0% 0% 0% 0%)",
          });
          return;
        }

        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

        intro
          .fromTo(
            heroReveal,
            {
              opacity: 0,
              y: 34,
              filter: "blur(14px)",
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.05,
              stagger: 0.11,
            },
          )
          .fromTo(
            heroImages,
            {
              opacity: 0,
              y: 60,
              scale: 1.08,
              rotate: -2,
              filter: "blur(12px)",
              clipPath: "inset(14% 10% 14% 10% round 2rem)",
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              rotate: 0,
              filter: "blur(0px)",
              clipPath: "inset(0% 0% 0% 0% round 2rem)",
              duration: 1.25,
              stagger: 0.14,
            },
            "-=0.65",
          )
          .fromTo(
            line,
            {
              opacity: 0,
              scaleX: 0,
              transformOrigin: "left center",
            },
            {
              opacity: 1,
              scaleX: 1,
              duration: 1.1,
            },
            "-=0.55",
          );

        gsap.to(floatItems, {
          y: -18,
          rotate: 1.5,
          duration: 4.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.28,
        });

        gsap.to(glowItems, {
          scale: 1.08,
          opacity: 0.85,
          duration: 5.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.4,
        });

        gsap.fromTo(
          cards,
          {
            opacity: 0,
            y: 54,
            scale: 0.965,
            filter: "blur(10px)",
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.95,
            ease: "power3.out",
            stagger: 0.08,
            scrollTrigger: {
              trigger: "[data-collection-section]",
              start: "top 72%",
              once: true,
            },
          },
        );

        gsap.to("[data-parallax-soft]", {
          yPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom top",
            scrub: 1.2,
          },
        });
      }, root);

      cleanup = () => ctx.revert();
    }

    runAnimation();

    return () => {
      cleanup?.();
    };
  }, [products.length]);

  return (
    <main
      ref={rootRef}
      data-no-text-motion
      className="overflow-hidden bg-[#fff8ec] text-[#2a1810]"
    >
      <section className="relative isolate min-h-[86vh] overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div
          data-glow
          className="pointer-events-none absolute left-[-18rem] top-[-18rem] h-[42rem] w-[42rem] rounded-full bg-[#c9a84c]/25 blur-3xl"
        />
        <div
          data-glow
          className="pointer-events-none absolute bottom-[-20rem] right-[-18rem] h-[44rem] w-[44rem] rounded-full bg-[#7b1c2e]/15 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.72),rgba(255,248,236,0.18)_44%,rgba(217,184,117,0.18))]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="relative z-10">
            <nav
              data-hero-reveal
              aria-label="Breadcrumb"
              className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b1e2d]"
            >
              <Link href="/" className="transition hover:text-[#2a1810]">
                Home
              </Link>
              <span className="text-[#c9a84c]">/</span>
              <span>Wedding Boxes</span>
            </nav>

            <p
              data-hero-reveal
              className="mb-5 inline-flex rounded-full border border-[#c9a84c]/45 bg-white/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#7b1c2e] shadow-sm backdrop-blur"
            >
              Premium wedding presentation
            </p>

            <h1
              data-hero-reveal
              className="max-w-4xl text-5xl font-semibold leading-[0.88] tracking-[-0.065em] text-[#24130b] sm:text-6xl md:text-7xl lg:text-8xl"
            >
              Wedding boxes, made unforgettable.
            </h1>

            <p
              data-hero-reveal
              className="mt-7 max-w-xl text-base leading-8 text-[#715746] sm:text-lg"
            >
              Elegant invitation boxes for the first moment your wedding feels real.
            </p>

            <div
              data-hero-reveal
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="#wedding-box-collection"
                className="group inline-flex items-center justify-center rounded-full bg-[#2a1810] px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#f6d889] shadow-[0_18px_45px_rgba(42,24,16,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#7b1c2e]"
              >
                Explore boxes
                <span className="ml-3 transition duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-[#2a1810]/15 bg-white/55 px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#2a1810] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#7b1c2e]/40 hover:bg-white"
              >
                Custom enquiry
              </Link>
            </div>

          <div className="relative min-h-[540px] lg:min-h-[690px]">
            <div
              data-glow
              className="absolute left-[12%] top-[20%] h-72 w-72 rounded-full bg-[#c9a84c]/25 blur-3xl"
            />
            <div
              data-parallax-soft
              className="absolute left-[8%] top-[9%] h-72 w-72 rounded-full border border-[#d9b875]/50"
            />

            <div
              data-hero-image
              data-float
              className="absolute left-0 top-12 z-20 w-[68%] max-w-[520px] overflow-hidden rounded-[2rem] border border-[#d9b875]/40 bg-[#f7ead6] shadow-[0_34px_110px_rgba(64,34,15,0.22)] sm:left-8 lg:left-0"
            >
              <div className="aspect-[4/5]">
                {heroImages[0] ? (
                  <img
                    src={heroImages[0]}
                    alt="Premium wedding box"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_20%,#fff7e8_0%,#f2dfbd_42%,#d3aa54_100%)] text-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7b604d]">
                        Wedding Box
                      </p>
                      <p className="mt-4 text-6xl">✦</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#211107]/42 via-transparent to-white/10" />
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/45" />
            </div>

            <div
              data-hero-image
              data-float
              className="absolute right-0 top-0 z-10 w-[48%] max-w-[350px] overflow-hidden rounded-[1.7rem] border border-[#d9b875]/40 bg-[#f7ead6] shadow-[0_24px_80px_rgba(64,34,15,0.15)]"
            >
              <div className="aspect-[4/5]">
                {heroImages[1] ? (
                  <img
                    src={heroImages[1]}
                    alt="Wedding box detail"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_30%_15%,#fff9ea_0%,#ead1a0_48%,#b9823d_100%)]" />
                )}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#211107]/32 via-transparent to-white/10" />
            </div>

            <div
              data-hero-image
              data-float
              className="absolute bottom-0 right-4 z-30 w-[58%] max-w-[440px] overflow-hidden rounded-[1.7rem] border border-[#d9b875]/40 bg-[#f7ead6] shadow-[0_30px_95px_rgba(64,34,15,0.2)] sm:right-10"
            >
              <div className="aspect-[5/4]">
                {heroImages[2] ? (
                  <img
                    src={heroImages[2]}
                    alt="Luxury wedding invitation box"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_35%_20%,#fff9ea_0%,#ead1a0_48%,#9d5b33_100%)]" />
                )}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#211107]/38 via-transparent to-white/10" />
            </div>

            <div className="absolute bottom-16 left-0 z-40 hidden max-w-[265px] rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_22px_70px_rgba(64,34,15,0.16)] backdrop-blur md:block">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b1e2d]">
                Signature finish
              </p>
              <p className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#2a1810]">
                A box that feels like the first gift.
              </p>
            </div>
          </div>
        </div>

        <div
          data-gold-line
          className="mx-auto mt-16 h-px max-w-7xl bg-gradient-to-r from-transparent via-[#c9a84c]/70 to-transparent"
        />
      </section>

      <section
        id="wedding-box-collection"
        data-collection-section
        className="relative isolate px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/40 to-transparent" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b1e2d]">
                The collection
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#2a1810] sm:text-5xl">
                Wedding Boxes
              </h2>
            </div>

            <p className="max-w-sm text-sm leading-7 text-[#806553]">
              Showing ERP items where Subject is{" "}
              <span className="font-semibold text-[#2a1810]">{subjectLabel}</span>.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[2rem] border border-[#7b1c2e]/20 bg-white/70 p-8 text-center shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b1e2d]">
                ERPNext connection problem
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                Couldn&apos;t load wedding boxes
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#806553]">
                {errorMessage}
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[2rem] border border-[#d9b875]/40 bg-white/70 p-10 text-center shadow-sm backdrop-blur">
              <p className="text-5xl">✦</p>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#2a1810]">
                Wedding box collection is being prepared
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#806553]">
                Add products in ERPNext with Subject set to{" "}
                <span className="font-semibold text-[#2a1810]">{subjectLabel}</span>.
              </p>
              <Link
                href="/contact"
                className="mt-7 inline-flex rounded-full bg-[#2a1810] px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#f6d889] transition hover:bg-[#7b1c2e]"
              >
                Contact us
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <WeddingBoxProductCard key={product.slug} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] border border-[#d9b875]/40 bg-[#2a1810] p-8 text-[#fff8ec] shadow-[0_30px_100px_rgba(42,24,16,0.2)] sm:p-10 lg:p-12">
          <div className="flex flex-col justify-between gap-7 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f6d889]">
                Bespoke wedding boxes
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                Need a box made around your wedding story?
              </h2>
            </div>

            <Link
              href="/contact"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#f6d889] px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#2a1810] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Request custom box
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}