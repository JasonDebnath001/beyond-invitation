import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import styles from "./HeroCarousel.module.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-potli-serif",
  display: "swap",
});

// Add the supplied image URL here when it is ready.
const HERO_IMAGE_URL = "https://res.cloudinary.com/dxzuvk7np/image/upload/v1794386620/Arched_potli_portrait_ohzliq.png";

export default function HeroCarousel() {
  return (
    <section
      aria-labelledby="homepage-hero-title"
      data-no-text-motion
      className={`${styles.hero} ${cormorant.variable}`}
    >
      <div className={styles.canvas}>
        <h1 id="homepage-hero-title" className={styles.title}>
          Potli Bags
        </h1>

        <p className={styles.tagline}>
          Small treasures.
          <br />
          Grand gestures.
        </p>

        <div className={styles.imageFrame} aria-hidden={!HERO_IMAGE_URL}>
          {HERO_IMAGE_URL && (
            <Image
              src={HERO_IMAGE_URL}
              alt="Embroidered potli bags"
              fill
              priority
              unoptimized
              sizes="(max-width: 899px) 76vw, (min-width: 1920px) 652px, 34vw"
              className={styles.image}
            />
          )}
        </div>

        <div className={styles.intro}>
          <h2 className={styles.introTitle}>Meet our Potli Bags</h2>
          <p className={styles.description}>
            A beautiful home for your thoughtful little gifts. Discover potli bags
            that bring a touch of tradition and a little more joy to every
            celebration.
          </p>
        </div>

        <Link href="/search?q=potli" className={styles.cta}>
          <span aria-hidden="true" className={styles.pin} />
          <span className={styles.ctaEyebrow}>
            Your next celebration, sorted.
          </span>
          <span className={styles.ctaLabel}>Explore Potli Bags</span>
          <svg
            aria-hidden="true"
            className={styles.arrow}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 18 18 6M6 6h12v12" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
