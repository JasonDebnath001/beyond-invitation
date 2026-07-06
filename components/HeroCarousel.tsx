"use client";

import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  {
    src: "https://ik.imagekit.io/71sbb5rn6/ChatGPT%20Image%20Jul%206,%202026,%2012_52_54%20PM.png",
    mobileSrc:
      "https://ik.imagekit.io/71sbb5rn6/ChatGPT%20Image%20Jul%206,%202026,%2003_44_31%20PM.png",
    alt: "Luxury wedding box collection hero image",
  },
  {
    src: "/hero1.png",
    mobileSrc: "/mobile_hero1.png",
    alt: "Hero image 1",
  },
  {
    src: "/hero2.png",
    mobileSrc: "/mobile_hero2.png",
    alt: "Hero image 2",
  },
  {
    src: "/hero3.png",
    mobileSrc: "/mobile_hero3.png",
    alt: "Hero image 3",
  },
];

const AUTO_ADVANCE_MS = 5000;

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  const total = SLIDES.length;

  const goNext = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      goNext();
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [goNext]);

  return (
    <section className="relative overflow-hidden bg-carbon">
      {/* Slide track */}
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className="relative flex min-h-[560px] w-full min-w-full items-center justify-center overflow-hidden"
          >
            <picture className="h-full w-full">
              <source media="(max-width: 767px)" srcSet={slide.mobileSrc} />

              <img
                src={slide.src}
                alt={slide.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className={`h-full w-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  i === current ? "scale-100" : "scale-150"
                }`}
              />
            </picture>
          </div>
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous slide"
        className="absolute left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/75"
      >
        &#8592;
      </button>

      <button
        type="button"
        onClick={goNext}
        aria-label="Next slide"
        className="absolute right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/75"
      >
        &#8594;
      </button>

      {/* Progress dots */}
      <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-2.5">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/75"
          >
            <span
              className={`h-px transition-all duration-300 ${
                i === current ? "w-6 bg-white" : "w-3 bg-white/30"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}