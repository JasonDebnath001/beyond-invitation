"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const COLLECTION_HREF = "/collections/shagun-boxes";
// If you create a new category slug later, change this to:
// const COLLECTION_HREF = "/collections/wedding-boxes";

const QUOTE_HREF = "/contact";

const IMAGES = {
  main: "https://ik.imagekit.io/71sbb5rn6/ChatGPT%20Image%20Jul%206,%202026,%2004_52_48%20PM.png",
  top: "https://ik.imagekit.io/71sbb5rn6/ChatGPT%20Image%20Jul%206,%202026,%2004_09_42%20PM.png",
  bottom: "https://ik.imagekit.io/71sbb5rn6/ChatGPT%20Image%20Jul%206,%202026,%2004_12_38%20PM.png",
};

const DETAILS = [
  {
    title: "Curated for the first reveal",
    text: "Designed to make the invitation feel like the first gift of the wedding.",
  },
  {
    title: "Made for custom stories",
    text: "Personalise names, inserts, colours, finishes, and presentation details.",
  },
  {
    title: "Crafted for family gifting",
    text: "Ideal for wedding cards, shagun, sweets, dry fruits, and premium keepsakes.",
  },
];

function ImageFrame({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      data-image-card
      className={`group relative overflow-hidden rounded-[2rem] border border-[#d9b875]/35 bg-[#f7ead6] shadow-[0_28px_90px_rgba(64,34,15,0.16)] ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full min-h-[240px] w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#fff7e8_0%,#f5dfbd_38%,#d9b875_100%)] px-8 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7b4d22]/70">
              Add image link
            </p>
            <p className="mt-3 font-serif text-2xl text-[#42230f]">
              Wedding box image
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2b170b]/35 via-transparent to-white/10 opacity-70" />
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/35" />
    </div>
  );
}

export default function WeddingBoxesEditorial() {
  const rootRef = useRef<HTMLElement | null>(null);

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
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const ctx = gsap.context(() => {
        const revealItems = root.querySelectorAll("[data-editorial-reveal]");
        const imageCards = root.querySelectorAll("[data-image-card]");
        const floatingItems = root.querySelectorAll("[data-float-soft]");
        const parallaxItems = root.querySelectorAll("[data-parallax-soft]");
        const detailCards = root.querySelectorAll("[data-detail-card]");

        if (reduceMotion) {
          gsap.set([revealItems, imageCards, detailCards], {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
          });
          return;
        }

        const introTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 72%",
            once: true,
          },
        });

        introTimeline
          .fromTo(
            revealItems,
            {
              opacity: 0,
              y: 34,
              filter: "blur(10px)",
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.95,
              ease: "power3.out",
              stagger: 0.12,
            }
          )
          .fromTo(
            imageCards,
            {
              opacity: 0,
              y: 48,
              scale: 0.96,
              filter: "blur(8px)",
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 1,
              ease: "power3.out",
              stagger: 0.14,
            },
            "-=0.65"
          )
          .fromTo(
            detailCards,
            {
              opacity: 0,
              y: 20,
            },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "power2.out",
              stagger: 0.1,
            },
            "-=0.55"
          );

        gsap.to(floatingItems, {
          y: -16,
          duration: 4.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: 0.35,
        });

        parallaxItems.forEach((item) => {
          gsap.fromTo(
            item,
            { y: 34 },
            {
              y: -34,
              ease: "none",
              scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            }
          );
        });
      }, root);

      cleanup = () => ctx.revert();
    }

    runAnimation();

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      data-no-text-motion
      className="relative isolate overflow-hidden bg-[#fff8ec] px-4 py-20 text-[#2a1810] sm:px-6 lg:px-8 lg:py-28"
    >
      {/* Soft background atmosphere */}
      <div className="pointer-events-none absolute left-[-12%] top-[-20%] h-[420px] w-[420px] rounded-full bg-[#d9b875]/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-18%] right-[-12%] h-[520px] w-[520px] rounded-full bg-[#8b1e2d]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d9b875]/70 to-transparent" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        {/* Copy */}
        <div className="relative z-10">

          <h2
            data-editorial-reveal
            className="max-w-3xl font-serif text-4xl leading-[0.95] tracking-[-0.04em] text-[#2a1810] sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Introducing premium wedding boxes.
          </h2>

          <p
            data-editorial-reveal
            className="mt-7 max-w-xl text-base leading-8 text-[#6f5847] sm:text-lg"
          >
            A collection created for the moment before the celebration begins —
            where the wedding invitation arrives wrapped in beauty, detail, and
            a feeling your guests remember.
          </p>

          <div
            data-editorial-reveal
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              href={COLLECTION_HREF}
              className="group inline-flex items-center justify-center rounded-full bg-[#2a1810] px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[#8b1e2d]"
            >
              Explore Boxes
              <span className="ml-3 transition duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>

            <Link
              href={QUOTE_HREF}
              className="inline-flex items-center justify-center rounded-full border border-[#2a1810]/20 bg-white/50 px-7 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#2a1810] transition duration-300 hover:-translate-y-0.5 hover:border-[#8b1e2d]/40 hover:bg-white"
            >
              Request Custom Quote
            </Link>
          </div>

          <div
            data-editorial-reveal
            className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-y border-[#d9b875]/40 py-5"
          >
            <div>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#7b604d]">
                Premium Finish
              </p>
            </div>
            <div>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#7b604d]">
                Customisable
              </p>
            </div>
            <div>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#7b604d]">
                Gift Ready
              </p>
            </div>
          </div>
        </div>

        {/* Editorial image layout */}
        <div className="relative min-h-[560px] lg:min-h-[690px]">
          <div
            data-float-soft
            data-parallax-soft
            className="absolute left-0 top-8 z-20 w-[68%] max-w-[520px] sm:left-8 lg:left-0"
          >
            <ImageFrame
              src={IMAGES.main}
              alt="Premium wedding invitation box editorial view"
              className="aspect-[4/5]"
              priority
            />
          </div>

          <div
            data-float-soft
            data-parallax-soft
            className="absolute right-0 top-0 z-10 w-[48%] max-w-[340px]"
          >
            <ImageFrame
              src={IMAGES.top}
              alt="Wedding box close up detail"
              className="aspect-[4/5] rounded-[1.7rem]"
            />
          </div>

          <div
            data-float-soft
            data-parallax-soft
            className="absolute bottom-0 right-4 z-30 w-[58%] max-w-[430px] sm:right-10"
          >
            <ImageFrame
              src={IMAGES.bottom}
              alt="Open wedding box presentation"
              className="aspect-[5/4] rounded-[1.7rem]"
            />
          </div>

          <div className="absolute left-[10%] top-[54%] z-0 h-56 w-56 rounded-full border border-[#d9b875]/45" />
          <div className="absolute right-[18%] top-[28%] z-0 h-72 w-72 rounded-full bg-[#d9b875]/20 blur-2xl" />

          <div className="absolute bottom-16 left-0 z-40 hidden max-w-[270px] rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_22px_70px_rgba(64,34,15,0.16)] backdrop-blur md:block">
            <p className="mt-3 font-serif text-2xl leading-tight text-[#2a1810]">
              Made to feel like a wedding gift before the wedding begins.
            </p>
          </div>
        </div>
      </div>

      {/* Detail cards */}
      <div className="mx-auto mt-14 grid max-w-7xl gap-4 md:grid-cols-3 lg:mt-20">
        {DETAILS.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            data-detail-card
            className="rounded-[1.75rem] border border-[#d9b875]/35 bg-white/45 p-6 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/70"
          >
            <h3 className="font-serif text-2xl leading-tight text-[#2a1810]">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#6f5847]">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}