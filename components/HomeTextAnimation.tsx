"use client";

import { useEffect, useRef } from "react";

const TEXT_ITEMS = [
  "Wedding Cards",
  "Rakhi Packaging",
  "Shagun Envelopes",
  "Custom Designs",
  "Premium Printing",
  "Pan-India Delivery",
  "Wholesale & Retail",
  "Beyond Invitation"
];

export default function HomeTextAnimation() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function runAnimation() {
      const gsapModule = await import("gsap");
      const scrollTriggerModule = await import("gsap/ScrollTrigger");

      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger;

      gsap.registerPlugin(ScrollTrigger);

      const root = rootRef.current;
      const track = trackRef.current;
      const pageScope = document.querySelector("[data-home-text-motion]");

      if (!root || !track || !pageScope) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const eventCleanups: Array<() => void> = [];

      const ctx = gsap.context(() => {
        const headings = Array.from(
          pageScope.querySelectorAll<HTMLElement>("h1, section h2")
        ).filter((heading) => {
          const text = heading.textContent?.trim() || "";

          return (
            text.length > 2 &&
            !heading.closest("[data-home-text-ticker]") &&
            !heading.closest("[data-no-text-motion]")
          );
        });

        const eyebrowTexts = Array.from(
          pageScope.querySelectorAll<HTMLElement>("section p")
        ).filter((text) => {
          const value = text.textContent?.trim() || "";

          return (
            value.length > 3 &&
            value.length < 70 &&
            !text.closest("[data-home-text-ticker]") &&
            !text.closest("[data-no-text-motion]")
          );
        });

        const ctas = Array.from(
          pageScope.querySelectorAll<HTMLElement>("a, button")
        ).filter((item) => {
          const value = item.textContent?.trim() || "";

          return (
            value.length > 2 &&
            value.length < 40 &&
            /view|shop|explore|catalogue|contact|visit|all|products/i.test(
              value
            ) &&
            !item.closest("[data-home-text-ticker]")
          );
        });

        headings.forEach((heading) => {
          heading.classList.add("home-text-premium-heading");
        });

        ctas.forEach((cta) => {
          cta.classList.add("home-text-premium-cta");
        });

        if (reduceMotion) {
          gsap.set(headings, {
            opacity: 1,
            y: 0,
            filter: "blur(0px)"
          });

          gsap.set(eyebrowTexts, {
            opacity: 1,
            y: 0
          });

          return;
        }

        gsap.fromTo(
          root,
          {
            opacity: 0,
            y: 16
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: "power3.out"
          }
        );

        const marqueeTween = gsap.to(track, {
          xPercent: -50,
          duration: 24,
          repeat: -1,
          ease: "none"
        });

        const handleEnter = () => {
          marqueeTween.timeScale(0.25);
        };

        const handleLeave = () => {
          marqueeTween.timeScale(1);
        };

        root.addEventListener("pointerenter", handleEnter);
        root.addEventListener("pointerleave", handleLeave);

        eventCleanups.push(() => {
          root.removeEventListener("pointerenter", handleEnter);
          root.removeEventListener("pointerleave", handleLeave);
        });

        headings.forEach((heading) => {
          gsap.fromTo(
            heading,
            {
              opacity: 0,
              y: 26,
              filter: "blur(7px)"
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.85,
              ease: "power3.out",
              scrollTrigger: {
                trigger: heading,
                start: "top 86%",
                once: true
              }
            }
          );
        });

        eyebrowTexts.forEach((text) => {
          gsap.fromTo(
            text,
            {
              opacity: 0,
              y: 12
            },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: text,
                start: "top 90%",
                once: true
              }
            }
          );
        });

        headings.forEach((heading) => {
          heading.addEventListener("pointerenter", () => {
            gsap.to(heading, {
              letterSpacing: "0.01em",
              duration: 0.25,
              ease: "power2.out"
            });
          });

          heading.addEventListener("pointerleave", () => {
            gsap.to(heading, {
              letterSpacing: "0em",
              duration: 0.25,
              ease: "power2.out"
            });
          });
        });
      }, root);

      cleanup = () => {
        eventCleanups.forEach((fn) => fn());
        ctx.revert();
      };
    }

    runAnimation();

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        .home-text-premium-heading {
          will-change: transform, opacity, filter, letter-spacing;
        }

        .home-text-premium-cta {
          position: relative;
          overflow: hidden;
        }

        .home-text-premium-cta::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 0.35rem;
          width: 68%;
          height: 1px;
          transform: translateX(-50%) scaleX(0);
          transform-origin: center;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(180, 83, 9, 0.65),
            transparent
          );
          transition: transform 240ms ease;
          pointer-events: none;
        }

        .home-text-premium-cta:hover::after {
          transform: translateX(-50%) scaleX(1);
        }
      `}</style>

      <section
        ref={rootRef}
        data-home-text-ticker
        className="border-y border-amber-900/10 bg-[#fffaf2] py-3"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-hidden px-4">
          <p className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.28em] text-amber-800/70 md:block">
            Explore
          </p>

          <div className="relative flex-1 overflow-hidden">
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 bg-gradient-to-r from-[#fffaf2] to-transparent" />
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-12 bg-gradient-to-l from-[#fffaf2] to-transparent" />

            <div
              ref={trackRef}
              className="flex w-max items-center gap-7 whitespace-nowrap"
            >
              {[...TEXT_ITEMS, ...TEXT_ITEMS].map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="flex items-center gap-7"
                >
                  <span className="text-sm font-semibold tracking-wide text-stone-800/75 md:text-base">
                    {item}
                  </span>

                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600/45" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}