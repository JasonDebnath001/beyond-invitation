"use client";

import { useEffect, useRef, useState } from "react";
import { useNearViewport } from "@/lib/use-near-viewport";

const REVIEW_VIDEOS = [
  "https://ik.imagekit.io/71sbb5rn6/WhatsApp%20Video%202026-07-16%20at%2012.03.57%20PM.mp4",
  "https://res.cloudinary.com/dxzuvk7np/video/upload/v1791204941/WhatsApp_Video_2026-10-05_at_6.23.30_PM_q1dg3k.mp4",
];

const CUSTOMER_QUOTE =
  "From the first design discussion to the final delivery, hear what the Beyond Invitation experience felt like — straight from our customer.";

function ReviewVideo({ src, index, enabled }: {
  src: string;
  index: number;
  enabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const loadSource = enabled || playRequested;

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    // Keyboard focus can reach this button before the observer's callback.
    if (!loadSource) {
      video.src = src;
      setPlayRequested(true);
    }
    void video.play().catch(() => setIsPlaying(false));
  };

  return (
    <div
      data-review-video
      className="relative w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-sm border border-gold/30 bg-carbon-dark shadow-xl sm:w-60 lg:w-[calc(50%-0.75rem)]"
    >
      <video
        ref={videoRef}
        src={loadSource ? src : undefined}
        aria-label={`Customer review video ${index + 1}`}
        controls={isPlaying}
        preload={loadSource ? "metadata" : "none"}
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
  const [sectionRef, isNearViewport] = useNearViewport<HTMLElement>();

  useEffect(() => {
    if (
      !isNearViewport ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const [gsapModule, scrollTriggerModule] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (!mounted) return;

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;

      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      if (!section) return;

      const ctx = gsap.context(() => {
        // Keep loaded content visible while adding a short entrance movement.
        gsap.from("[data-review-text] > *", {
          y: 16,
          duration: 0.35,
          stagger: 0.03,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 75%",
            once: true,
          },
        });
        gsap.from("[data-review-video]", {
          y: 20,
          scale: 0.98,
          duration: 0.4,
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

    void runAnimation().catch((error) => {
      console.warn("Customer review animation failed:", error);
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [isNearViewport, sectionRef]);

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
              <ReviewVideo
                key={src}
                src={src}
                index={index}
                enabled={isNearViewport}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
