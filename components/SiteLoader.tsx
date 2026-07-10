"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import { BRAND, TAGLINE } from "./siteConfig";

const MIN_VISIBLE_TIME = 1000;
const MAX_WAIT_TIME = 8000;

export default function SiteLoader() {
  const [isVisible, setIsVisible] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    const progress = progressRef.current;

    if (!root || !content || !leftPanel || !rightPanel || !progress) {
      setIsVisible(false);
      return;
    }

    /*
     * Disable the CSS no-JavaScript failsafe once the component hydrates.
     * GSAP controls the loader from this point onward.
     */
    root.classList.remove("site-loader-failsafe");

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    /*
     * Prevent layout shift when the scrollbar disappears.
     */
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const restoreBody = () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const select = gsap.utils.selector(root);

    let cancelled = false;
    let finished = false;
    let minimumTimeElapsed = false;
    let pageIsReady = false;
    let loadListener: (() => void) | null = null;

    let progressTween: ReturnType<typeof gsap.to> | null = null;
    let exitTimeline: ReturnType<typeof gsap.timeline> | null = null;

    let minimumTimer = 0;
    let maximumTimer = 0;

    const animationContext = gsap.context(() => {
      gsap.set(root, {
        autoAlpha: 1,
      });

      gsap.set(progress, {
        scaleX: 0,
        transformOrigin: "left center",
      });

      if (prefersReducedMotion) {
        gsap.set(select("[data-loader-copy]"), {
          autoAlpha: 1,
        });

        gsap.set(select("[data-loader-letter]"), {
          autoAlpha: 1,
          yPercent: 0,
        });

        return;
      }

      const introTimeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

      introTimeline
        .fromTo(
          select("[data-loader-seal]"),
          {
            autoAlpha: 0,
            scale: 0.72,
            rotation: -14,
          },
          {
            autoAlpha: 1,
            scale: 1,
            rotation: 0,
            duration: 0.9,
          },
        )
        .fromTo(
          select("[data-loader-letter]"),
          {
            autoAlpha: 0,
            yPercent: 125,
          },
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 0.7,
            stagger: 0.035,
          },
          0.18,
        )
        .fromTo(
          select("[data-loader-copy]"),
          {
            autoAlpha: 0,
            y: 12,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.08,
          },
          0.4,
        );

      /*
       * The bar deliberately stops below 100%.
       * It completes only after the document and fonts are ready.
       */
      progressTween = gsap.to(progress, {
        scaleX: 0.84,
        duration: 2.4,
        ease: "power2.out",
      });

      gsap.to(select("[data-loader-orbit]"), {
        rotation: 360,
        duration: 12,
        repeat: -1,
        ease: "none",
      });

      gsap.to(select("[data-loader-diamond]"), {
        y: -6,
        rotation: "+=45",
        duration: 1.5,
        stagger: 0.18,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.fromTo(
        select("[data-loader-dot]"),
        {
          autoAlpha: 0.25,
          scale: 0.75,
        },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.14,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        },
      );
    }, root);

    const finishLoader = () => {
      if (cancelled || finished) {
        return;
      }

      finished = true;

      window.clearTimeout(minimumTimer);
      window.clearTimeout(maximumTimer);

      if (loadListener) {
        window.removeEventListener("load", loadListener);
      }

      progressTween?.kill();

      if (prefersReducedMotion) {
        gsap.set(root, {
          autoAlpha: 0,
        });

        restoreBody();
        setIsVisible(false);
        return;
      }

      exitTimeline = gsap.timeline({
        onComplete: () => {
          if (cancelled) {
            return;
          }

          restoreBody();
          setIsVisible(false);
        },
      });

      exitTimeline
        .to(progress, {
          scaleX: 1,
          duration: 0.35,
          ease: "power2.out",
        })
        .to(
          select("[data-loader-status]"),
          {
            autoAlpha: 0,
            y: 8,
            duration: 0.25,
            ease: "power2.in",
          },
          0.14,
        )
        .to(
          select("[data-loader-copy]"),
          {
            autoAlpha: 0,
            y: -12,
            duration: 0.35,
            stagger: 0.035,
            ease: "power2.in",
          },
          0.2,
        )
        .to(
          content,
          {
            autoAlpha: 0,
            scale: 0.95,
            duration: 0.45,
            ease: "power3.in",
          },
          0.25,
        )
        .to(
          leftPanel,
          {
            xPercent: -102,
            duration: 0.95,
            ease: "power4.inOut",
          },
          0.34,
        )
        .to(
          rightPanel,
          {
            xPercent: 102,
            duration: 0.95,
            ease: "power4.inOut",
          },
          0.34,
        )
        .to(
          root,
          {
            autoAlpha: 0,
            duration: 0.12,
          },
          ">-0.05",
        );
    };

    const tryToFinish = () => {
      if (pageIsReady && minimumTimeElapsed) {
        finishLoader();
      }
    };

    minimumTimer = window.setTimeout(
      () => {
        minimumTimeElapsed = true;
        tryToFinish();
      },
      prefersReducedMotion ? 100 : MIN_VISIBLE_TIME,
    );

    /*
     * Never leave the visitor trapped behind a loader because one asset,
     * analytics script, font, or third-party resource failed.
     */
    maximumTimer = window.setTimeout(finishLoader, MAX_WAIT_TIME);

    const windowReady = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }

      loadListener = () => resolve();

      window.addEventListener("load", loadListener, {
        once: true,
      });
    });

    const fontsReady = document.fonts?.ready ?? Promise.resolve();

    void Promise.all([windowReady, fontsReady])
      .then(
        () =>
          new Promise<void>((resolve) => {
            /*
             * Give the browser two frames to paint the completed document
             * before the curtains open.
             */
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => resolve());
            });
          }),
      )
      .then(() => {
        if (cancelled) {
          return;
        }

        pageIsReady = true;
        tryToFinish();
      })
      .catch(() => {
        /*
         * Font-loading errors should not keep the overlay visible.
         */
        if (cancelled) {
          return;
        }

        pageIsReady = true;
        tryToFinish();
      });

    return () => {
      cancelled = true;

      window.clearTimeout(minimumTimer);
      window.clearTimeout(maximumTimer);

      if (loadListener) {
        window.removeEventListener("load", loadListener);
      }

      progressTween?.kill();
      exitTimeline?.kill();
      animationContext.revert();

      restoreBody();
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="site-loader-failsafe fixed inset-0 z-[9999] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Beyond Invitation"
    >
      {/* Left curtain */}
      <div
        ref={leftPanelRef}
        className="absolute inset-y-0 left-0 w-[51%] bg-carbon will-change-transform"
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(230,201,122,0.28) 0 1px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/15" />
      </div>

      {/* Right curtain */}
      <div
        ref={rightPanelRef}
        className="absolute inset-y-0 right-0 w-[51%] bg-carbon-dark will-change-transform"
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(230,201,122,0.24) 0 1px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-bl from-white/5 via-transparent to-black/20" />
      </div>

      {/* Fine centre seam */}
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px
                   -translate-x-1/2 bg-gradient-to-b from-transparent
                   via-gold/50 to-transparent"
        aria-hidden="true"
      />

      <div
        ref={contentRef}
        className="relative z-20 flex h-full min-h-[100svh] flex-col
                   items-center justify-center px-6 text-center text-cream"
      >
        {/* Rotating ornamental ring */}
        <div
          data-loader-orbit
          className="pointer-events-none absolute h-52 w-52 rounded-full
                     border border-gold/20 sm:h-64 sm:w-64"
          aria-hidden="true"
        >
          <span
            data-loader-diamond
            className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2
                       rotate-45 border border-gold bg-carbon"
          />

          <span
            data-loader-diamond
            className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2
                       rotate-45 border border-gold bg-carbon"
          />

          <span
            data-loader-diamond
            className="absolute left-[-4px] top-1/2 h-2 w-2 -translate-y-1/2
                       rotate-45 border border-gold bg-carbon"
          />

          <span
            data-loader-diamond
            className="absolute right-[-4px] top-1/2 h-2 w-2 -translate-y-1/2
                       rotate-45 border border-gold bg-carbon-dark"
          />
        </div>

        {/* Brand seal */}
        <div
          data-loader-seal
          className="relative mb-7 flex h-24 w-24 items-center justify-center
                     rounded-full border border-gold/70 bg-cream
                     shadow-[0_20px_70px_rgba(0,0,0,0.28)]
                     sm:h-28 sm:w-28"
        >
          <div className="absolute inset-2 rounded-full border border-carbon/15" />

          <Image
            src="/logo.ico"
            alt=""
            width={76}
            height={76}
            priority
            sizes="112px"
            className="relative h-16 w-16 object-contain sm:h-[72px] sm:w-[72px]"
          />
        </div>

        <p
          data-loader-copy
          className="mb-3 text-[10px] font-bold uppercase tracking-[0.42em]
                     text-gold-light sm:text-xs"
        >
          A celebration begins
        </p>

        <h1
          aria-label={BRAND}
          className="max-w-4xl text-3xl font-extrabold tracking-[0.06em]
                     text-cream sm:text-5xl lg:text-6xl"
        >
          {Array.from(BRAND).map((character, index) => (
            <span
              key={`${character}-${index}`}
              className="inline-block overflow-hidden align-bottom"
              aria-hidden="true"
            >
              <span data-loader-letter className="inline-block">
                {character === " " ? "\u00A0" : character}
              </span>
            </span>
          ))}
        </h1>

        <p
          data-loader-copy
          className="mt-4 text-xs font-semibold uppercase tracking-[0.28em]
                     text-cream/65 sm:text-sm"
        >
          {TAGLINE}
        </p>

        {/* Invitation-style ornament */}
        <div
          data-loader-copy
          className="my-7 flex w-full max-w-xs items-center gap-4"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
          <span className="h-2.5 w-2.5 rotate-45 border border-gold bg-gold/10" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
        </div>

        <div data-loader-copy className="w-full max-w-xs sm:max-w-sm">
          <div className="h-px overflow-hidden bg-white/15">
            <div
              ref={progressRef}
              className="h-full w-full origin-left bg-gradient-to-r
                         from-gold-light via-gold to-gold-light"
            />
          </div>

          <div
            data-loader-status
            className="mt-4 flex items-center justify-center gap-2
                       text-[10px] font-semibold uppercase tracking-[0.22em]
                       text-cream/55 sm:text-xs"
          >
            <span>Preparing your invitation experience</span>

            <span className="flex gap-1" aria-hidden="true">
              <span
                data-loader-dot
                className="h-1 w-1 rounded-full bg-gold-light"
              />
              <span
                data-loader-dot
                className="h-1 w-1 rounded-full bg-gold-light"
              />
              <span
                data-loader-dot
                className="h-1 w-1 rounded-full bg-gold-light"
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
