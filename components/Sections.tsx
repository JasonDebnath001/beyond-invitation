import Link from "next/link";
import type { ReactNode } from "react";
import type { Category } from "@/types";

/* ------------------------------------------------------------------ */
/* Shared building blocks                                             */
/* ------------------------------------------------------------------ */

/** Tracked-out uppercase eyebrow label used above section titles. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
      {children}
    </span>
  );
}

/** Standard section heading: eyebrow + serif title + hairline rule. */
function SectionHeading({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-[-0.01em] text-carbon md:text-[42px]">
        {title}
      </h2>
      <div
        className={`mt-5 h-px w-14 bg-carbon ${
          align === "center" ? "mx-auto" : ""
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                           */
/* ------------------------------------------------------------------ */

/** Static hero banner (legacy export — kept for compatibility). */
export function Hero() {
  const stats = [
    { num: "40,000+", label: "Happy Customers" },
    { num: "5,000+", label: "Unique Designs" },
    { num: "11", label: "Stores" },
    { num: "6", label: "Cities" },
  ];

  return (
    <div className="relative flex min-h-[520px] items-center overflow-hidden bg-carbon">
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-white/40" />
          <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/55">
            New Collection 2025
          </span>
        </div>
        <h1 className="mt-7 max-w-[600px] font-display text-[clamp(38px,5vw,64px)] font-medium leading-[1.1] text-white">
          Beautiful <em className="font-normal italic">wedding</em> invitations
          for every occasion
        </h1>
        <p className="mt-6 max-w-[480px] text-[15px] font-light leading-relaxed text-white/55">
          Handcrafted with intention — from the understated to the opulent,
          find the card that speaks your heart.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/collections/wedding"
            className="bg-white px-7 py-3.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon transition hover:bg-neutral-200"
          >
            Explore Collection &#8594;
          </Link>
          <Link
            href="/collections/luxe"
            className="border border-white/25 px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition hover:border-white"
          >
            View Luxe Range
          </Link>
        </div>
        <div className="mt-12 flex flex-wrap gap-10 border-t border-white/10 pt-8">
          {stats.map((s) => (
            <div key={s.label}>
              <span className="block font-display text-[28px] font-medium text-white">
                {s.num}
              </span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Editorial brand statement band. */
export function BrandStatement() {
  return (
    <section className="border-y border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center md:py-24">
        <Eyebrow>The Shahi Promise</Eyebrow>
        <p className="mt-7 text-balance font-display text-[26px] font-medium leading-[1.45] tracking-[-0.01em] text-carbon md:text-[34px]">
          An invitation is the first impression of a celebration. We make it one
          worth keeping — printed on the finest paper, finished entirely by
          hand.
        </p>
        <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-neutral-400">
          Shahi Cards — crafted for every milestone
        </p>
      </div>
    </section>
  );
}

/** "Shop by Celebration" category grid. */
export function CelebrationGrid({ categories }: { categories: Category[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <SectionHeading eyebrow="Browse by event" title="Shop by Celebration" />

      <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-7">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/collections/${cat.slug}`}
            className="group flex flex-col items-center justify-center gap-3 bg-white px-3 py-9 text-center transition-colors duration-300 hover:bg-carbon"
          >
            <span className="text-3xl transition-transform duration-300 group-hover:-translate-y-0.5">
              {cat.emoji}
            </span>
            <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-carbon transition-colors duration-300 group-hover:text-white">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Trust strip with delivery / quality highlights. */
export function FeatureStrip() {
  const items = [
    { title: "Custom Printing", sub: "Your names & details" },
    { title: "Pan-India Delivery", sub: "Every state covered" },
    { title: "Premium Quality", sub: "Finest paper & inks" },
    { title: "Bulk Discounts", sub: "Save more on larger orders" },
  ];

  return (
    <div className="bg-carbon">
      <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.title}
            className={`px-6 py-11 text-center md:py-14 ${
              i < items.length - 1 ? "md:border-r md:border-white/10" : ""
            } ${i < 2 ? "border-b border-white/10 md:border-b-0" : ""}`}
          >
            <div className="font-display text-[15px] font-medium uppercase tracking-[0.14em] text-white">
              {it.title}
            </div>
            <div className="mt-2 text-[12px] tracking-wide text-white/45">
              {it.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Why choose us" section. */
export function WhyUs() {
  const cards = [
    {
      no: "01",
      title: "Unbeatable Quality",
      text: "We use the finest paper and superior printing techniques to craft invitations that exude quiet elegance.",
    },
    {
      no: "02",
      title: "Exclusive Designs",
      text: "Our studio draws a diverse range of original designs, blending tradition with a restrained, modern hand.",
    },
    {
      no: "03",
      title: "A Personal Touch",
      text: "Every invitation is shaped around your style and theme — considered, never templated.",
    },
  ];

  return (
    <section className="bg-paper py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow="Our promise" title="Why Choose Shahi Cards" />

        <div className="mt-12 grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.no} className="bg-white p-9 md:p-10">
              <span className="font-display text-[40px] font-medium leading-none text-neutral-200">
                {c.no}
              </span>
              <h3 className="mt-5 font-display text-[20px] font-medium text-carbon">
                {c.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-neutral-500">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Customer testimonials. */
export function Testimonials() {
  const reviews = [
    {
      text: "Our wedding cards turned out beautiful and elegant. The paper and print quality were excellent, and everything arrived on time.",
      author: "Aishwarya & Nikhil",
      location: "Bangalore",
    },
    {
      text: "We wanted matching cards for a traditional theme. The team helped us customise the design and the result was simply perfect.",
      author: "Kavya & Suresh",
      location: "Coimbatore",
    },
    {
      text: "We wanted something simple yet refined, and the team understood exactly what we were after. A genuinely stress-free experience.",
      author: "Mathew & Ria",
      location: "Kochi",
    },
  ];

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow="Kind words" title="What People Are Saying" />

        <div className="mt-12 grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r.author} className="flex flex-col bg-white p-9 md:p-10">
              <div className="text-[12px] tracking-[0.3em] text-carbon">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </div>
              <blockquote className="mt-5 font-display text-[18px] font-medium italic leading-[1.5] text-carbon">
                &ldquo;{r.text}&rdquo;
              </blockquote>
              <figcaption className="mt-6 border-t border-neutral-200 pt-5">
                <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-carbon">
                  {r.author}
                </div>
                <div className="mt-1 text-[12px] tracking-wide text-neutral-400">
                  {r.location}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Milestone counters band. */
export function Milestones() {
  const items = [
    { num: "40,000+", label: "Happy Customers" },
    { num: "350K+", label: "Instagram Family" },
    { num: "11", label: "Stores" },
    { num: "6", label: "Cities" },
  ];

  return (
    <section className="bg-carbon">
      <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`px-6 py-14 text-center ${
              i < items.length - 1 ? "md:border-r md:border-white/10" : ""
            } ${i < 2 ? "border-b border-white/10 md:border-b-0" : ""}`}
          >
            <span className="block font-display text-[40px] font-medium leading-none text-white md:text-[48px]">
              {it.num}
            </span>
            <span className="mt-3 block text-[11px] uppercase tracking-[0.22em] text-white/45">
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}