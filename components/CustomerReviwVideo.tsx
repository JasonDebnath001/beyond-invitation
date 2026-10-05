"use client";

import { useEffect, useRef, useState } from "react";

const REVIEW_VIDEOS = [
  "https://ik.imagekit.io/71sbb5rn6/WhatsApp%20Video%202026-07-16%20at%2012.03.57%20PM.mp4",
  "https://res.cloudinary.com/dxzuvk7np/video/upload/v1791204941/WhatsApp_Video_2026-10-05_at_6.23.30_PM_q1dg3k.mp4",
];

const CUSTOMER_QUOTE =
  "From the first design discussion to the final delivery, hear what the Beyond Invitation experience felt like — straight from our customer.";

function ReviewVideo({ src, index }: { src: string; index: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    void videoRef.current?.play().catch(() => setIsPlaying(false));
  };

  return (
    <div
      data-review-video
      className="relative w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-sm border border-gold/30 bg-carbon-dark shadow-xl sm:w-60 lg:w-[calc(50%-0.75rem)]"
    >
      <video
        ref={videoRef}
        src={src}
        aria-label={`Customer review video ${index + 1}`}
        controls={isPlaying}
        preload="metadata"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
        className="aspect-[9/16] h-auto w-full object-cover"
      >
        Your browser does not support the video tag.
      </video>

      {!isPlaying && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play customer review video ${index + 1}`}
          className="group absolute inset-0 flex items-center justify-center bg-carbon-dark/30 transition hover:bg-carbon-dark/20"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-105">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-1 h-7 w-7 text-carbon"
              aria-hidden="true"
            >
              <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.04 1.04 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export default function CustomerReviewVideo() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;

      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      if (!section) return;

      const ctx = gsap.context(() => {
        // Text column: eyebrow → heading → quote, staggered in.
        gsap.from("[data-review-text] > *", {
          opacity: 0,
          y: 40,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            once: true,
          },
        });

        // Video card: rises, scales and un-rotates into place.
        gsap.from("[data-review-video]", {
          opacity: 0,
          y: 80,
          scale: 0.92,
          rotate: 3,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            once: true,
          },
        });

        // Gold frame behind the video drifts in slightly later for depth.
        gsap.from("[data-review-frame]", {
          opacity: 0,
          x: 24,
          y: 24,
          duration: 1,
          delay: 0.25,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 70%",
            once: true,
          },
        });
      }, section);

      cleanup = () => ctx.revert();
    }

    runAnimation();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden bg-paper py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text column */}
          <div data-review-text className="text-center lg:text-left">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-gold">
              In Their Own Words
            </p>

            <h2 className="font-serif text-3xl font-semibold uppercase tracking-[0.06em] text-carbon min-[400px]:text-4xl sm:text-5xl sm:tracking-[0.08em]">
              Hear From Our Customers
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-ink-mid sm:text-base lg:mx-0">
              {CUSTOMER_QUOTE}
            </p>
          </div>

          {/* Portrait review videos */}
          <div className="flex flex-wrap justify-center gap-6 lg:justify-end">
            {REVIEW_VIDEOS.map((src, index) => (
              <ReviewVideo key={src} src={src} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
