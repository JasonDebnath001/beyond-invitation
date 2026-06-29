"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

type CatalogueAnimatedCardProps = {
  title: string;
  price: string;
  image: string;
  href: string;
  className?: string;
  index?: number;
};

export default function CatalogueAnimatedCard({
  title,
  price,
  image,
  href,
  className = "",
  index = 0
}: CatalogueAnimatedCardProps) {
  const cardRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;

      gsap.registerPlugin(ScrollTrigger);

      const card = cardRef.current;

      if (!card) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const canHover = window.matchMedia("(hover: hover)").matches;

      const eventCleanups: Array<() => void> = [];

      const ctx = gsap.context(() => {
        const imageEl = card.querySelector(".catalogue-card-image");
        const overlayEl = card.querySelector(".catalogue-card-overlay");
        const contentEl = card.querySelector(".catalogue-card-content");
        const priceEl = card.querySelector(".catalogue-card-price");
        const titleEl = card.querySelector(".catalogue-card-title");
        const lineEl = card.querySelector(".catalogue-card-line");
        const shineEl = card.querySelector(".catalogue-card-shine");

        gsap.set(card, {
          opacity: 1,
          transformPerspective: 900,
          transformOrigin: "center center"
        });

        gsap.set(imageEl, {
          scale: 1.02,
          transformOrigin: "center center"
        });

        gsap.set(lineEl, {
          scaleX: 0,
          transformOrigin: "left center"
        });

        gsap.set(shineEl, {
          xPercent: -130,
          opacity: 0
        });

        if (reduceMotion) {
          gsap.set(card, {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)"
          });

          gsap.set(contentEl, {
            opacity: 1,
            y: 0
          });

          gsap.set(lineEl, {
            scaleX: 1
          });

          return;
        }

        gsap.fromTo(
          card,
          {
            opacity: 0,
            y: 42,
            scale: 0.96,
            filter: "blur(8px)"
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.85,
            delay: index * 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              once: true
            }
          }
        );

        gsap.fromTo(
          contentEl,
          {
            opacity: 0,
            y: 22
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            delay: index * 0.08 + 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              once: true
            }
          }
        );

        gsap.to(lineEl, {
          scaleX: 1,
          duration: 0.75,
          delay: index * 0.08 + 0.22,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%",
            once: true
          }
        });

        if (!canHover) return;

        const rotateX = gsap.quickTo(card, "rotationX", {
          duration: 0.45,
          ease: "power3.out"
        });

        const rotateY = gsap.quickTo(card, "rotationY", {
          duration: 0.45,
          ease: "power3.out"
        });

        const imageX = gsap.quickTo(imageEl, "x", {
          duration: 0.6,
          ease: "power3.out"
        });

        const imageY = gsap.quickTo(imageEl, "y", {
          duration: 0.6,
          ease: "power3.out"
        });

        const handlePointerEnter = () => {
          gsap.to(card, {
            y: -8,
            duration: 0.35,
            ease: "power3.out"
          });

          gsap.to(imageEl, {
            scale: 1.09,
            duration: 0.8,
            ease: "power3.out"
          });

          gsap.to(overlayEl, {
            opacity: 0.34,
            duration: 0.35,
            ease: "power2.out"
          });

          gsap.to(priceEl, {
            y: -3,
            opacity: 0.95,
            duration: 0.3,
            ease: "power2.out"
          });

          gsap.to(titleEl, {
            y: -4,
            letterSpacing: "0.045em",
            duration: 0.35,
            ease: "power2.out"
          });

          gsap.fromTo(
            shineEl,
            {
              xPercent: -130,
              opacity: 0
            },
            {
              xPercent: 230,
              opacity: 1,
              duration: 0.85,
              ease: "power3.out"
            }
          );
        };

        const handlePointerLeave = () => {
          rotateX(0);
          rotateY(0);
          imageX(0);
          imageY(0);

          gsap.to(card, {
            y: 0,
            rotationX: 0,
            rotationY: 0,
            duration: 0.45,
            ease: "power3.out"
          });

          gsap.to(imageEl, {
            x: 0,
            y: 0,
            scale: 1.02,
            duration: 0.75,
            ease: "power3.out"
          });

          gsap.to(overlayEl, {
            opacity: 0.45,
            duration: 0.35,
            ease: "power2.out"
          });

          gsap.to(priceEl, {
            y: 0,
            opacity: 1,
            duration: 0.3,
            ease: "power2.out"
          });

          gsap.to(titleEl, {
            y: 0,
            letterSpacing: "0.025em",
            duration: 0.35,
            ease: "power2.out"
          });

          gsap.to(shineEl, {
            opacity: 0,
            duration: 0.2,
            ease: "power2.out"
          });
        };

        const handlePointerMove = (event: PointerEvent) => {
          const rect = card.getBoundingClientRect();

          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;

          rotateY(x * 5);
          rotateX(y * -4);

          imageX(x * -10);
          imageY(y * -8);
        };

        card.addEventListener("pointerenter", handlePointerEnter);
        card.addEventListener("pointerleave", handlePointerLeave);
        card.addEventListener("pointermove", handlePointerMove, {
          passive: true
        });

        eventCleanups.push(() => {
          card.removeEventListener("pointerenter", handlePointerEnter);
          card.removeEventListener("pointerleave", handlePointerLeave);
          card.removeEventListener("pointermove", handlePointerMove);
        });
      }, card);

      cleanup = () => {
        eventCleanups.forEach((fn) => fn());
        ctx.revert();
      };
    }

    runAnimation();

    return () => {
      cleanup?.();
    };
  }, [index]);

  return (
    <Link
      ref={cardRef}
      href={href}
      className={`catalogue-gsap-card group relative block h-[280px] overflow-hidden bg-stone-950 outline-none [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-gold md:h-[300px] ${className}`}
    >
      <Image
        src={image}
        alt={title}
        width={900}
        height={600}
        className="catalogue-card-image h-full w-full object-cover will-change-transform"
      />

      <div className="catalogue-card-overlay absolute inset-0 bg-black opacity-45 will-change-opacity" />

      <div className="catalogue-card-shine pointer-events-none absolute inset-y-0 -left-1/3 z-10 hidden w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm md:block" />

      <div className="catalogue-card-content absolute bottom-7 left-7 z-20 pr-6 text-white [transform:translateZ(34px)]">
        <p className="catalogue-card-price mb-3 text-sm font-bold uppercase tracking-wide text-white/90">
          {price}
        </p>

        <h3 className="catalogue-card-title text-3xl font-bold tracking-[0.025em]">
          {title}
        </h3>

        <div className="catalogue-card-line mt-4 h-px w-20 bg-gradient-to-r from-gold via-white/70 to-transparent" />

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          Explore Range
        </p>
      </div>
    </Link>
  );
}