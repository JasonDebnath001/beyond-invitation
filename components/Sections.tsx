import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Category } from "@/types";

/* ------------------------------------------------------------------ */
/* Shared building blocks */
/* ------------------------------------------------------------------ */

/** Tracked-out uppercase eyebrow label used above section titles. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold">
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
    <div className={align === "center" ? "text-center" : "text-left"}>
      <Eyebrow>{eyebrow}</Eyebrow>

      <h2 className="font-serif text-3xl text-carbon md:text-4xl">
        {title}
      </h2>

      <div
        className={`mt-5 h-px w-24 bg-gold ${
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
    <section className="relative overflow-hidden bg-cream py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-2">
        <div>
          <Eyebrow>New Collection 2025</Eyebrow>

          <h1 className="font-serif text-5xl leading-tight text-carbon md:text-7xl">
            Beautiful wedding invitations for every occasion
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
            Handcrafted with intention — from the understated to the opulent,
            find the card that speaks your heart.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/collections/wedding-cards"
              className="rounded-full bg-carbon px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-gold"
            >
              Explore Collection →
            </Link>

            <Link
              href="/collections/luxe"
              className="rounded-full border border-carbon px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-carbon transition hover:border-gold hover:text-gold"
            >
              View Luxe Range
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-8 shadow-sm">
          <div className="grid grid-cols-2 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="border-l border-gold pl-4">
                <p className="font-serif text-3xl text-carbon">{s.num}</p>
                <p className="mt-1 text-sm uppercase tracking-[0.18em] text-neutral-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Editorial brand statement band. */
export function BrandStatement() {
  return (
    <section className="bg-carbon px-6 py-14 text-center">
      <p className="mx-auto max-w-4xl font-serif text-2xl leading-relaxed text-cream md:text-3xl">
        An invitation is the first impression of a celebration. We make it one
        worth keeping — printed on the finest paper, finished entirely by hand.
      </p>
    </section>
  );
}

/** Shop by Category carousel. */
export function CelebrationGrid({
  categories: _categories,
}: {
  categories: Category[];
}) {
  const categoryItems = [
    {
      name: "Hindu Wedding Cards",
      slug: "wedding-card-hindu",
      image: "/category/hindu-wedding-cards.jpeg",
    },
    {
      name: "Muslim Wedding Cards",
      slug: "wedding-card-muslim",
      image: "/category/muslim-wedding-cards.jpeg",
    },
    {
      name: "Christian Wedding Cards",
      slug: "wedding-card-christian",
      image: "/category/christian-wedding-cards.jpeg",
    },
    {
      name: "Shagun Envelopes",
      slug: "shagun-envelopes",
      image: "/category/shagun-envelopes.jpeg",
    },
    {
      name: "Shagun Boxes",
      slug: "shagun-boxes",
      image: "/category/shagun-boxes.jpeg",
    },
    {
      name: "Rakhi Cards",
      slug: "rakhi-cards",
      image: "/category/rakhi-cards.jpeg",
    },
    {
      name: "Rakhi Boxes",
      slug: "rakhi-boxes",
      image: "/category/rakhi-boxes.jpeg",
    },
    {
      name: "Rakhi Tags",
      slug: "rakhi-tags",
      image: "/category/rakhi-tags.jpeg",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#fffaf4] to-white py-20 md:py-24">
      <div className="pointer-events-none absolute left-0 top-16 h-56 w-56 rounded-full bg-[#d4af37]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-[#7a1f1f]/10 blur-3xl" />

      <div className="relative w-full px-6">
        <SectionHeading eyebrow="Curated collections" title="Shop by Category" />

        <div className="mt-12 overflow-x-auto pb-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-6 md:gap-8">
            {categoryItems.map((cat) => (
              <div
                key={cat.slug}
                className="group min-w-[155px] snap-start text-center sm:min-w-[175px] md:min-w-[190px]"
              >
                <Link
                  href={`/collections/${cat.slug}`}
                  aria-label={`View ${cat.name} collection`}
                  className="relative mx-auto inline-block h-36 w-36 rounded-full bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200 transition duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_24px_70px_rgba(122,31,31,0.18)] sm:h-40 sm:w-40 md:h-44 md:w-44"
                >
                  <div className="absolute inset-1 rounded-full border border-dashed border-[#d4af37]/50" />

                  <div className="relative h-full w-full overflow-hidden rounded-full bg-neutral-100">
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 144px, (max-width: 768px) 160px, 176px"
                      className="object-cover transition duration-700 group-hover:scale-110"
                    />
                  </div>
                </Link>

                {/* labels removed: image contains category name visually */}
              </div>
            ))}
          </div>
        </div>
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
    <section className="bg-white px-6 py-12">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.title}
            className="rounded-3xl border border-neutral-200 bg-cream p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              0{i + 1}
            </p>

            <h3 className="mt-4 font-serif text-2xl text-carbon">
              {it.title}
            </h3>

            <p className="mt-2 text-sm text-neutral-600">{it.sub}</p>
          </div>
        ))}
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
    <section className="bg-cream px-6 py-20 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Why choose us" title="The Beyond Invitation Promise" />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.no}
              className="rounded-[2rem] bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="font-serif text-5xl text-gold">{c.no}</p>

              <h3 className="mt-6 font-serif text-2xl text-carbon">
                {c.title}
              </h3>

              <p className="mt-4 leading-7 text-neutral-600">{c.text}</p>
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
    <section className="bg-white px-6 py-20 md:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Client words" title="Loved by families across India" />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.map((r) => (
            <article
              key={r.author}
              className="rounded-[2rem] border border-neutral-200 p-8"
            >
              <p className="text-gold">★★★★★</p>

              <blockquote className="mt-5 leading-7 text-neutral-700">
                “{r.text}”
              </blockquote>

              <div className="mt-6">
                <p className="font-semibold text-carbon">{r.author}</p>
                <p className="text-sm text-neutral-500">{r.location}</p>
              </div>
            </article>
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
    <section className="bg-carbon px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-8 text-center md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <p className="font-serif text-4xl text-gold md:text-5xl">
              {it.num}
            </p>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-cream">
              {it.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}