import Link from "next/link";
import type { Category } from "@/types";

/** Top announcement strip. */
export function AnnounceBar() {
  return (
    <div className="bg-maroon px-4 py-2 text-center text-[12.5px] font-medium tracking-wide text-gold-light">
      ✦ <span className="text-white">40,000+</span> Happy Customers &nbsp;|&nbsp;
      Shop across <span className="text-white">11 Stores</span> in{" "}
      <span className="text-white">6 Cities</span> &nbsp;|&nbsp; Free
      Customization on All Orders ✦
    </div>
  );
}

/** Homepage hero banner. */
export function Hero() {
  const stats = [
    { num: "40,000+", label: "Happy Customers" },
    { num: "5,000+", label: "Unique Designs" },
    { num: "11", label: "Stores" },
    { num: "6", label: "Cities" },
  ];

  return (
    <div className="relative flex min-h-[520px] items-center overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-[#9E2D44]">
      <div className="absolute right-[-80px] top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full border border-gold/15" />
      <div className="absolute bottom-[-80px] left-[-120px] h-[400px] w-[400px] rounded-full border border-gold/10" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/15 px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.1em] text-gold-light">
          ✦ New Collection 2025
        </span>
        <h1 className="mb-4 max-w-[600px] font-display text-[clamp(38px,5vw,64px)] font-bold leading-[1.15] text-white">
          Beautiful <em className="not-italic text-gold-light">Wedding</em>{" "}
          Invitations for Every Occasion
        </h1>
        <p className="mb-9 max-w-[480px] text-base font-light leading-relaxed text-white/75">
          Handcrafted with love — from budget-friendly to luxurious, find the
          perfect invitation card that speaks your heart.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <Link
            href="/collections/wedding"
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-7 py-3 text-sm font-semibold text-maroon-dark transition hover:-translate-y-0.5 hover:bg-gold-light"
          >
            Explore Collection →
          </Link>
          <Link
            href="/collections/luxe"
            className="inline-flex items-center gap-2 rounded-lg border border-gold/50 px-6 py-3 text-sm font-medium text-gold-light transition hover:border-gold hover:bg-gold/10"
          >
            View Luxe Range
          </Link>
        </div>

        <div className="mt-13 flex flex-wrap gap-8 border-t border-gold/20 pt-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <span className="block font-display text-[28px] font-bold text-gold-light">
                {s.num}
              </span>
              <span className="text-[11px] uppercase tracking-[0.1em] text-white/60">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "Shop by Celebration" category grid. */
export function CelebrationGrid({ categories }: { categories: Category[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-11 text-center">
        <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
          Browse by event
        </span>
        <h2 className="font-display text-3xl font-semibold text-maroon-dark md:text-[38px]">
          Shop by Celebration
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/collections/${cat.slug}`}
            className="group overflow-hidden rounded-2xl border border-gold/25 bg-white pb-4 text-center transition hover:-translate-y-1 hover:border-gold hover:shadow-[0_8px_30px_rgba(123,28,46,0.1)]"
          >
            <div className="mb-3 flex h-28 items-center justify-center bg-gold-pale text-4xl transition group-hover:bg-gold/30">
              {cat.emoji}
            </div>
            <span className="block px-2 text-[13px] font-medium text-ink">
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
    { icon: "✂️", title: "Custom Printing", sub: "Your names & details" },
    { icon: "🚚", title: "Pan India Delivery", sub: "All states covered" },
    { icon: "💎", title: "Premium Quality", sub: "Finest paper & inks" },
    { icon: "🤝", title: "Bulk Discounts", sub: "Save more on orders" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6 bg-gradient-to-br from-maroon-dark to-maroon px-6 py-10">
      {items.map((it) => (
        <div key={it.title} className="flex flex-col items-center gap-1.5 text-white">
          <div className="text-3xl">{it.icon}</div>
          <div className="text-sm font-semibold">{it.title}</div>
          <div className="text-[12px] text-white/65">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** "Why choose us" section. */
export function WhyUs() {
  const cards = [
    {
      icon: "🏆",
      title: "Unbeatable Quality",
      text: "We use the finest paper and superior printing techniques to craft invitations that exude elegance.",
    },
    {
      icon: "🎨",
      title: "Exclusive Designs",
      text: "Our team crafts a diverse range of unique designs, blending tradition and innovation.",
    },
    {
      icon: "💝",
      title: "Personalised Touch",
      text: "We design invitations that beautifully reflect your style and match your wedding theme.",
    },
  ];

  return (
    <section className="bg-ivory py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-11 text-center">
          <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Our Promise
          </span>
          <h2 className="font-display text-3xl font-semibold text-maroon-dark md:text-[38px]">
            Why Choose Shahi Cards?
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-gold/25 bg-white p-9 text-center transition hover:border-gold hover:shadow-[0_8px_32px_rgba(123,28,46,0.08)]"
            >
              <span className="mb-4 block text-5xl">{c.icon}</span>
              <h3 className="mb-2.5 font-display text-[19px] font-semibold text-maroon-dark">
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-mid">{c.text}</p>
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
      text: "Our wedding invitation cards turned out beautiful and elegant. The quality of paper and print was really good, delivered on time.",
      author: "Aishwarya & Nikhil",
      location: "Bangalore",
    },
    {
      text: "We wanted matching cards for a traditional theme. The team helped us customize the design and the result was just perfect.",
      author: "Kavya & Suresh",
      location: "Coimbatore",
    },
    {
      text: "We wanted something simple yet classy, and the team understood exactly what we were looking for. Stress-free experience.",
      author: "Mathew & Ria",
      location: "Kochi",
    },
  ];

  return (
    <section className="bg-ivory py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-11 text-center">
          <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Happy Customers
          </span>
          <h2 className="font-display text-3xl font-semibold text-maroon-dark md:text-[38px]">
            What People Are Saying
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {reviews.map((r) => (
            <div
              key={r.author}
              className="rounded-2xl border border-gold/25 bg-white p-6"
            >
              <div className="mb-3 text-base tracking-[2px] text-gold">
                ★★★★★
              </div>
              <p className="mb-4 font-serif text-[15px] italic leading-relaxed text-ink-mid">
                &ldquo;{r.text}&rdquo;
              </p>
              <div className="text-[13px] font-semibold text-maroon">
                {r.author}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-light">
                {r.location}
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
    <div className="flex justify-center bg-maroon px-6 py-14">
      <div className="grid w-full max-w-4xl grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`px-4 py-6 text-center ${
              i < items.length - 1 ? "md:border-r md:border-gold/20" : ""
            }`}
          >
            <span className="block font-display text-4xl font-bold text-gold-light">
              {it.num}
            </span>
            <span className="mt-1.5 block text-[12px] uppercase tracking-[0.1em] text-white/70">
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
