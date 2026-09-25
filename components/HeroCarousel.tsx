"use client";

import { Alice } from "next/font/google";
import Image from "next/image";
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./HeroCarousel.module.css";

const alice = Alice({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const HERO_WIDTH = 1366;
const HERO_HEIGHT = 438;

// Coordinates include each PNG's transparent padding in the reference artwork.
const HERO_CARDS = [
  { src: "/hero-card-1.png", width: 219, height: 273, x: -15, y: 240, mobile: { width: 27, x: -4, y: 14 } },
  { src: "/hero-card-2.png", width: 273, height: 360, x: 232, y: 180, mobile: { width: 35, x: 10, y: -16 } },
  { src: "/hero-card-3.png", width: 265, height: 353, x: 532, y: 205, mobile: { width: 35, x: 33, y: -2 } },
  { src: "/hero-card-4.png", width: 242, height: 322, x: 825, y: 234, mobile: { width: 30, x: 57, y: 8 } },
  { src: "/hero-card-5.png", width: 465, height: 436, x: 1047, y: 161, mobile: { width: 58, x: 72, y: -14 } },
];

export default function HeroCarousel() {
  const cardsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = cardsRef.current;
    if (!root) return;

    const media = gsap.matchMedia();

    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const cards = Array.from(
          root.querySelectorAll<HTMLImageElement>("[data-hero-card]"),
        );
        const shuffledCards = gsap.utils.shuffle([...cards]);

        // A random shuffle can still return left-to-right order; avoid that result.
        if (shuffledCards.every((card, index) => card === cards[index])) {
          [shuffledCards[0], shuffledCards[1]] = [
            shuffledCards[1],
            shuffledCards[0],
          ];
        }

        let cancelled = false;
        const imagesReady = Promise.all(
          cards.map((card) => card.decode().catch(() => undefined)),
        );
        const timeline = gsap.timeline({ paused: true });

        gsap.set(cards, {
          y: (_index, card: HTMLImageElement) =>
            root.clientHeight - card.offsetTop + 12,
          scale: 0.96,
          autoAlpha: 0,
          transformOrigin: "center bottom",
        });

        timeline.to(shuffledCards, {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.85,
          stagger: 0.24,
          ease: "back.out(1.35)",
          clearProps: "transform,transformOrigin,opacity,visibility",
        });

        void imagesReady.then(() => {
          if (!cancelled) timeline.play();
        });

        return () => {
          cancelled = true;
        };
      },
      root,
    );

    return () => media.revert();
  }, []);

  return (
    <section
      aria-labelledby="homepage-hero-title"
      data-no-text-motion
      className={styles.hero}
      style={{ backgroundImage: "url('/hero-bg.png')" }}
    >
      <div className={styles.content}>
        <h1
          id="homepage-hero-title"
          className={styles.title}
          style={{ fontFamily: alice.style.fontFamily }}
        >
          Invitation that go beyond your expectations
        </h1>
        <p
          className={styles.subtitle}
          style={{ fontFamily: alice.style.fontFamily }}
        >
          Designed with love, crafted by experts, and delivered on time.
        </p>
      </div>
      <div
        ref={cardsRef}
        aria-hidden="true"
        className={styles.cards}
      >
        {HERO_CARDS.map((card) => (
          <Image
            key={card.src}
            data-hero-card
            src={card.src}
            alt=""
            width={card.width}
            height={card.height}
            sizes={`(max-width: 767px) ${card.mobile.width}vw, (min-width: 1920px) ${Math.ceil((card.width / HERO_WIDTH) * 1920)}px, ${Math.ceil((card.width / HERO_WIDTH) * 100)}vw`}
            priority
            quality={90}
            draggable={false}
            className={styles.card}
            style={
              {
                "--card-left": `${(card.x / HERO_WIDTH) * 100}%`,
                "--card-top": `${(card.y / HERO_HEIGHT) * 100}%`,
                "--card-width": `${(card.width / HERO_WIDTH) * 100}%`,
                "--card-mobile-left": `${card.mobile.x}%`,
                "--card-mobile-top": `${card.mobile.y}%`,
                "--card-mobile-width": `${card.mobile.width}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </section>
  );
}
