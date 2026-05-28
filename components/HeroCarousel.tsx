"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/*
 * Hero carousel — auto-advancing editorial slides.
 * Monochrome premium theme: near-black stage, white type.
 * Edit the SLIDES array to change the banners.
 */

interface HeroSlide {
  badge: string;
  titleLead: string;
  /** Emphasised word — rendered in italic serif */
  titleEmphasis: string;
  titleTail: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}

const SLIDES: HeroSlide[] = [
  {
    badge: "New Collection 2025",
    titleLead: "Beautiful",
    titleEmphasis: "wedding",
    titleTail: "invitations for every occasion",
    text: "Handcrafted with intention — from the understated to the opulent, find the card that speaks before a single word is read.",
    primaryLabel: "Explore the Collection",
    primaryHref: "/collections/wedding",
    secondaryLabel: "View Catalogue",
    secondaryHref: "/collections/luxe",
  },
  {
    badge: "Elite & Opulent",
    titleLead: "Luxury",
    titleEmphasis: "invitation",
    titleTail: "boxes for grand celebrations",
    text: "Velvet-lined boxes finished entirely by hand — the most considered way to announce your day.",
    primaryLabel: "Explore Luxe",
    primaryHref: "/collections/luxe",
    secondaryLabel: "See All Cards",
    secondaryHref: "/collections/wedding",
  },
  {
    badge: "Limited-Time Offer",
    titleLead: "Up to",
    titleEmphasis: "68% off",
    titleTail: "the flash sale collection",
    text: "Premium designs at exceptional prices. Choose your favourite invitation before the offer closes.",
    primaryLabel: "Shop the Sale",
    primaryHref: "/collections/wedding",
    secondaryLabel: "Browse Themes",
    secondaryHref: "/collections/housewarming",
  },
];

const AUTO_ADVANCE_MS = 6000;

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const total = SLIDES.length;

  const goNext = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  // Auto-advance, paused while the pointer is over the hero.
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, goNext]);

  return (
    <section
      className="relative overflow-hidden bg-carbon"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide track */}
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.badge}
            className="relative flex min-h-[560px] w-full min-w-full items-center"
          >
            {/* Oversized faint slide numeral */}
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 select-none font-display text-[42vw] font-medium leading-none text-white/[0.04] md:text-[26vw]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="animate-fadeUp relative z-10 mx-auto w-full max-w-7xl px-6 py-20 md:px-10">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-white/40" />
                <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/55">
                  {slide.badge}
                </span>
              </div>

              <h1 className="mt-7 max-w-[780px] font-display text-[clamp(36px,5.4vw,68px)] font-medium leading-[1.08] tracking-[-0.01em] text-white">
                {slide.titleLead}{" "}
                <em className="font-normal italic">{slide.titleEmphasis}</em>{" "}
                {slide.titleTail}
              </h1>

              <p className="mt-6 max-w-[480px] text-[15px] font-light leading-relaxed text-white/55">
                {slide.text}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={slide.primaryHref}
                  className="group inline-flex items-center gap-2 bg-white px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon transition hover:bg-neutral-200"
                >
                  {slide.primaryLabel}
                  <span className="transition-transform group-hover:translate-x-1">
                    &#8594;
                  </span>
                </Link>
                <Link
                  href={slide.secondaryHref}
                  className="inline-flex items-center gap-2 border border-white/25 px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition hover:border-white hover:bg-white/5"
                >
                  {slide.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous slide"
        className="absolute left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/5 md:flex"
      >
        &#8592;
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label="Next slide"
        className="absolute right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/5 md:flex"
      >
        &#8594;
      </button>

      {/* Progress dots */}
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.badge}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-px transition-all duration-300 ${
              i === current ? "w-12 bg-white" : "w-6 bg-white/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}