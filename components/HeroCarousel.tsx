"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/*
 * Hero carousel — auto-advancing promotional slides.
 * Smaller than the old static hero (440px vs 520px).
 * Edit the SLIDES array to change the banners.
 */

interface HeroSlide {
  badge: string;
  titleLead: string;
  titleEmphasis: string;
  titleTail: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  /** Tailwind gradient classes for the slide background */
  gradient: string;
}

const SLIDES: HeroSlide[] = [
  {
    badge: "New Collection 2025",
    titleLead: "Beautiful",
    titleEmphasis: "Wedding",
    titleTail: "Invitations for Every Occasion",
    text: "Handcrafted with love — from budget-friendly to luxurious, find the perfect card that speaks your heart.",
    primaryLabel: "Explore Collection",
    primaryHref: "/collections/wedding",
    secondaryLabel: "View Catalogue",
    secondaryHref: "/collections/luxe",
    gradient: "from-maroon-dark via-maroon to-[#9E2D44]",
  },
  {
    badge: "Elite & Opulent",
    titleLead: "Luxury",
    titleEmphasis: "Invitation",
    titleTail: "Boxes for Grand Celebrations",
    text: "Velvet-lined boxes with hand-finished detailing — the ultimate way to announce your big day.",
    primaryLabel: "Explore Luxe Range",
    primaryHref: "/collections/luxe",
    secondaryLabel: "See All Cards",
    secondaryHref: "/collections/wedding",
    gradient: "from-[#2A0A12] via-[#3D0E1C] to-maroon-dark",
  },
  {
    badge: "Limited Time Offer",
    titleLead: "Up to",
    titleEmphasis: "68% Off",
    titleTail: "on Our Flash Sale Collection",
    text: "Premium designs at unbeatable prices. Grab your favourite invitation cards before the offer ends.",
    primaryLabel: "Shop the Sale",
    primaryHref: "/collections/wedding",
    secondaryLabel: "Browse Themes",
    secondaryHref: "/collections/housewarming",
    gradient: "from-[#5A1220] via-maroon to-[#7B1C2E]",
  },
];

const AUTO_ADVANCE_MS = 5000;

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
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide track */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {SLIDES.map((slide) => (
          <div
            key={slide.badge}
            className={`relative flex min-h-[440px] w-full min-w-full items-center bg-gradient-to-br ${slide.gradient}`}
          >
            <div className="absolute right-[-80px] top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full border border-gold/15" />
            <div className="absolute bottom-[-90px] left-[-110px] h-[340px] w-[340px] rounded-full border border-gold/10" />

            <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/15 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.1em] text-gold-light">
                ✦ {slide.badge}
              </span>
              <h1 className="mb-4 max-w-[600px] font-display text-[clamp(32px,4.4vw,54px)] font-bold leading-[1.15] text-white">
                {slide.titleLead}{" "}
                <em className="not-italic text-gold-light">
                  {slide.titleEmphasis}
                </em>{" "}
                {slide.titleTail}
              </h1>
              <p className="mb-8 max-w-[460px] text-[15px] font-light leading-relaxed text-white/75">
                {slide.text}
              </p>
              <div className="flex flex-wrap gap-3.5">
                <Link
                  href={slide.primaryHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-maroon-dark transition hover:-translate-y-0.5 hover:bg-gold-light"
                >
                  {slide.primaryLabel} →
                </Link>
                <Link
                  href={slide.secondaryHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold/50 px-6 py-2.5 text-sm font-medium text-gold-light transition hover:border-gold hover:bg-gold/10"
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
        className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-black/25 text-lg text-gold-light backdrop-blur-sm transition hover:bg-black/40"
      >
        &#8592;
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-black/25 text-lg text-gold-light backdrop-blur-sm transition hover:bg-black/40"
      >
        &#8594;
      </button>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.badge}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === current ? "w-7 bg-gold" : "w-2 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}