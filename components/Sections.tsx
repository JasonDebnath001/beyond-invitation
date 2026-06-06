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
      className={`mb-10 ${
        align === "center" ? "text-center" : "text-left"
      }`}
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

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <p className="font-serif text-3xl text-white">{s.num}</p>
              <p className="mt-2 text-sm text-stone-300">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
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
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Explore our range" title="Shop by Category" />

        <div className="flex gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryItems.map((cat) => (
            <Link
              key={cat.slug}
              href={`/collections/${cat.slug}`}
              className="group min-w-[180px] text-center sm:min-w-[220px]"
            >
              <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100 p-2 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl sm:h-48 sm:w-48">
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="220px"
                    className="object-cover transition duration-500 group-hover:scale-110"
                  />
                </div>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-stone-900 sm:text-base">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Sale collection section.
 *
 * Only this section creates sale pricing:
 * - price = original ERP price
 * - mrp = 20% increased price, shown as strikethrough
 */
export function SaleCollection({ products }: { products: Product[] }) {
  const saleProducts: Product[] = products.map((product) => {
    const originalPrice = Number(product.price || 0);
    const increasedMrp = Math.ceil(originalPrice * 1.2);

    return {
      ...product,
      price: originalPrice,
      mrp: increasedMrp,
      badge: "SALE",
      onSale: true,
    };
  });

  return (
    <ProductSection
      label="Limited time offer"
      title="Sale Collection"
      products={saleProducts}
      viewAllHref="/collections/wedding"
      viewAllText="View All Sale Products"
      shaded
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
    <section className="bg-stone-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.title} className="rounded-3xl border border-white/10 p-6">
            <p className="text-xs font-semibold tracking-[0.3em] text-amber-400">
              0{i + 1}
            </p>

            <h3 className="mt-4 font-serif text-2xl">{it.title}</h3>

            <p className="mt-2 text-sm text-stone-300">{it.sub}</p>
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
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading eyebrow="Why choose us" title="Made for Moments" />

        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.no}
              className="rounded-[2rem] border border-stone-200 bg-[#fbf7f0] p-8"
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
            <div key={r.author} className="rounded-[2rem] bg-white p-8 shadow-sm">
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