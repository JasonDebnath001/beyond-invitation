import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProductSection } from "@/components/ProductGrid";
import type { Category, Product } from "@/types";

/* ------------------------------------------------------------------ */
/* Shared building blocks */
/* ------------------------------------------------------------------ */

/** Tracked-out uppercase eyebrow label used above section titles. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">
      {children}
    </p>
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
    <div
      className={`mb-10 ${align === "center" ? "text-center" : "text-left"}`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>

      <h2 className="mt-3 font-serif text-3xl text-stone-950 sm:text-4xl md:text-5xl">
        {title}
      </h2>

      <div
        className={`mt-5 h-px w-24 bg-amber-700/40 ${
          align === "center" ? "mx-auto" : ""
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections */
/* ------------------------------------------------------------------ */

/** Static hero banner legacy export — kept for compatibility. */
export function Hero() {
  const stats = [
    { num: "40,000+", label: "Happy Customers" },
    { num: "5,000+", label: "Unique Designs" },
    { num: "11", label: "Stores" },
    { num: "6", label: "Cities" },
  ];

  return (
    <section className="relative overflow-hidden bg-stone-950 px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Eyebrow>New Collection 2026</Eyebrow>

          <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl md:text-6xl">
            Beautiful wedding invitations for every occasion
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
            Handcrafted with intention — from the understated to the opulent,
            find the card that speaks your heart.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/collections/wedding"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100"
            >
              Explore Collection →
            </Link>

            <Link
              href="/collections/luxe"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-stone-950"
            >
              View Luxe Range
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:rounded-3xl sm:p-6"
            >
              <p className="font-serif text-2xl text-white sm:text-3xl">
                {s.num}
              </p>
              <p className="mt-2 text-sm text-stone-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Shop by Category section. */
export function CelebrationGrid({
  categories: _categories,
}: {
  categories: Category[];
}) {
  const categoryItems = [
    {
      name: "Hindu Wedding Cards",
      slug: "wedding-card-hindu",
      image: "/category/hindu-wedding-cards.png",
    },
    {
      name: "Muslim Wedding Cards",
      slug: "wedding-card-muslim",
      image: "/category/muslim-wedding-cards.png",
    },
    {
      name: "Christian Wedding Cards",
      slug: "wedding-card-christian",
      image: "/category/christian-wedding-cards.png",
    },
    {
      name: "Shagun Envelopes",
      slug: "shagun-envelopes",
      image: "/category/shagun-envelopes.png",
    },
    {
      name: "Shagun Boxes",
      slug: "shagun-boxes",
      image: "/category/shagun-boxes.png",
    },
    {
      name: "Rakhi Cards",
      slug: "rakhi-cards",
      image: "/category/rakhi-cards.png",
    },
    {
      name: "Rakhi Boxes",
      slug: "rakhi-boxes",
      image: "/category/rakhi-boxes.png",
    },
    {
      name: "Rakhi Tags",
      slug: "rakhi-tags",
      image: "/category/rakhi-tags.png",
    },
  ];

  return (
    <section
      aria-labelledby="browse-by-event-heading"
      className="bg-[#fcf7f0] px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 xl:px-[2.15%] xl:pb-[clamp(112px,13.9vw,250px)] xl:pt-[clamp(96px,10.2vw,184px)]"
    >
      <div className="mx-auto max-w-[1728px]">
        <h2
          id="browse-by-event-heading"
          className="text-center [font-family:'Times_New_Roman',Times,serif] text-[42px] font-normal leading-[1.1] tracking-[-0.035em] text-[#70070b] sm:text-[60px] xl:text-[clamp(64px,5vw,90px)]"
        >
          Browse By Event
        </h2>

        <div aria-hidden="true" className="mx-auto mt-2.5 flex h-[30px] w-[220px] items-center gap-2 text-[#dfa566] sm:w-[300px]">
          <span className="h-px flex-1 bg-current" />
          <svg viewBox="0 0 48 32" className="h-[30px] w-[44px] shrink-0 fill-none stroke-current" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 27C15 20 17 10 24 2c7 8 9 18 0 25Z" />
            <path d="M24 27C12 25 8 16 10 8c10 2 15 8 14 19Zm0 0c12-2 16-11 14-19-10 2-15 8-14 19Z" />
            <path d="M24 27C12 30 5 24 2 17c10-2 18 1 22 10Zm0 0c12 3 19-3 22-10-10-2-18 1-22 10Z" />
            <path d="M24 27C16 23 12 14 17 5m7 22c8-4 12-13 7-22M24 7v20m-6 1 6 3 6-3" />
          </svg>
          <span className="h-px flex-1 bg-current" />
        </div>

        <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-6 sm:mt-12 sm:grid-cols-4 sm:gap-x-4 xl:mt-[48px] xl:grid-cols-8 xl:gap-x-[0.84vw]">
          {categoryItems.map((cat) => (
            <Link
              key={cat.slug}
              href={`/collections/${cat.slug}`}
              aria-label={cat.name}
              className="group flex min-w-0 flex-col text-center outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70070b]"
            >
              <div className="rounded-t-full border border-b-0 border-[#e9b17c] p-[3px] pb-0">
                <div className="relative aspect-[183/269] overflow-hidden rounded-t-full">
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="(min-width: 1800px) 195px, (min-width: 1280px) 12vw, (min-width: 640px) 25vw, 50vw"
                    className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
                  />
                </div>
              </div>

              <h3 className="flex-1 whitespace-nowrap rounded-b-[24px] border border-t-0 border-[#e9b17c] px-px pb-6 pt-[18px] [font-family:'Times_New_Roman',Times,serif] text-[clamp(12px,3.8vw,18px)] font-normal uppercase leading-[1.3] text-[#7b0d12] sm:text-[clamp(12px,1.7vw,18px)] xl:min-h-[90px] xl:text-[clamp(12px,1.05vw,19px)]">
                {cat.name.slice(0, cat.name.lastIndexOf(" "))}
                <br />
                {cat.name.slice(cat.name.lastIndexOf(" ") + 1)}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Sale collection section, using the prices supplied by the catalogue. */
export function SaleCollection({
  products,
  nextOffset,
}: {
  products: Product[];
  nextOffset: number | null;
}) {
  return (
    <ProductSection
      label="Limited time offer"
      title="Sale Collection"
      products={products}
      nextOffset={nextOffset}
      sale
      pricedOnly
      viewAllHref="/collections/wedding"
      viewAllText="View All Sale Products"
    />
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
    <section className="bg-[#85172b] px-4 py-10 text-white sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={it.title}
              className="group flex min-h-[130px] flex-col rounded-2xl border border-white/15 bg-white/[0.04] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#e6c27a]/70 hover:bg-white/[0.07] sm:min-h-[145px] sm:p-5 lg:min-h-[155px]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e6c27a]/50 text-[11px] font-semibold text-[#f3d99b] sm:h-9 sm:w-9 sm:text-xs">
                  0{i + 1}
                </span>

                <span className="h-px flex-1 bg-gradient-to-r from-[#e6c27a]/60 to-transparent" />
              </div>

              <div className="mt-auto pt-4">
                <h3 className="font-serif text-lg leading-snug text-white sm:text-xl lg:text-2xl">
                  {it.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/65">{it.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Why choose us section. */
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
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Why choose us" title="Made for Moments" />

        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.no}
              className="rounded-[1.5rem] border border-stone-200 bg-[#fbf7f0] p-6 sm:rounded-[2rem] sm:p-8"
            >
              <p className="font-serif text-4xl text-amber-700/50">{c.no}</p>

              <h3 className="mt-6 font-serif text-2xl text-stone-950">
                {c.title}
              </h3>

              <p className="mt-4 leading-7 text-stone-600">{c.text}</p>
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
    <section className="bg-[#f8f2ea] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Loved by families" title="Kind Words" />

        <div className="grid gap-6 md:grid-cols-3">
          {reviews.map((r) => (
            <div
              key={r.author}
              className="rounded-[2rem] bg-white p-8 shadow-sm"
            >
              <p className="text-sm tracking-[0.2em] text-amber-600">★★★★★</p>

              <blockquote className="mt-5 leading-8 text-stone-700">
                “{r.text}”
              </blockquote>

              <div className="mt-6">
                <p className="font-semibold text-stone-950">{r.author}</p>
                <p className="text-sm text-stone-500">{r.location}</p>
              </div>
            </div>
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
    <section className="bg-stone-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <p className="font-serif text-4xl text-white">{it.num}</p>
            <p className="mt-2 text-sm text-stone-300">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OurShowroom() {
  const address =
    "Shop No. 8, Indra Kumar Karnani St, China Bazar, B.B.D. Bagh, Kolkata, West Bengal 700001";

  return (
    <section className="bg-white px-4 py-14 sm:px-8 sm:py-16 lg:px-10 xl:px-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left Side: Address */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-gold">
            Visit Us
          </p>

          <h2 className="mb-8 font-serif text-3xl font-semibold uppercase tracking-[0.06em] text-carbon min-[400px]:text-4xl sm:text-5xl sm:tracking-[0.08em]">
            Our Showroom
          </h2>

          <div className="border-y border-carbon/15 py-6">
            <div className="flex gap-3 sm:gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-lg sm:h-12 sm:w-12 sm:text-xl">
                📍
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold text-carbon">
                  Kolkata, West Bengal
                </h3>

                <p className="max-w-xl text-base leading-8 text-carbon/70">
                  {address}
                </p>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    address,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-full bg-carbon px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-gold"
                >
                  View on Maps
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Showroom Image */}
        <div className="relative overflow-hidden rounded-[2rem] border border-gold/20 bg-ivory shadow-card">
          <Image
            src="/showroom.jpeg"
            alt="Beyond Invitation Kolkata showroom"
            width={800}
            height={500}
            className="h-[320px] w-full object-cover sm:h-[420px] lg:h-[460px]"
          />
        </div>
      </div>
    </section>
  );
}
