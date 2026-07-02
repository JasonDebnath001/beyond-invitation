// app/about/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, TAGLINE } from "@/components/siteConfig";
import { siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `About Us | ${BRAND}`,
  description:
    "Learn about Beyond Invitation, a brand of Bharat Agency Wedding Cards Pvt. Ltd., carrying a 65+ year legacy in wedding cards, shagun envelopes, Rakhi packaging and celebration stationery.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    url: siteUrl("/about"),
  },
};

const highlights = [
  { value: "65+", label: "Years of Legacy" },
  { value: "3", label: "Celebrations Categories" },
  { value: "Premium", label: "Cards, Envelopes & Packaging" },
  { value: "Kolkata", label: "Based Wedding Card House" },
];

const values = [
  {
    no: "01",
    title: "A legacy built on trust",
    text: "Beyond Invitation is the brand of Bharat Agency Wedding Cards Pvt. Ltd., a company that has been around for more than 65 years and has served families through generations of celebrations.",
  },
  {
    no: "02",
    title: "From greetings to weddings",
    text: "The journey started with greeting cards and gradually expanded into wedding cards, carrying forward the same warmth, care and personal touch that made every message feel special.",
  },
  {
    no: "03",
    title: "Tradition with new ideas",
    text: "Today, the company offers wedding cards, shagun envelopes, Rakhi packaging and boxes, blending decades of experience with designs made for modern Indian celebrations.",
  },
];

const services = [
  "Wedding Cards",
  "Designer Wedding Cards",
  "Shagun / Money Envelopes",
  "Rakhi Packaging",
  "Rakhi Boxes",
  "Special Occasion Cards",
];

const process = [
  {
    title: "Discover",
    text: "Explore collections by style, religion, theme, finish and budget.",
  },
  {
    title: "Personalise",
    text: "Share names, event details, wording preferences and design changes.",
  },
  {
    title: "Approve",
    text: "Review the final layout carefully before the print process begins.",
  },
  {
    title: "Celebrate",
    text: "Receive invitations that set the perfect tone for your occasion.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-white text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-carbon" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-gold" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:px-10 lg:grid-cols-2 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-carbon">
              Our Story
            </p>

            <h1 className="font-display text-4xl leading-[1.08] text-carbon sm:text-5xl lg:text-6xl">
              Invitations that carry a legacy.
            </h1>

            <p className="mt-6 text-base leading-8 text-ink-mid sm:text-lg">
              {BRAND} is the brand of Bharat Agency Wedding Cards Pvt. Ltd.,
              a company with a legacy of over 65 years. What started as a
              greeting card business gradually grew into a trusted wedding card
              house, and today we create wedding cards, shagun envelopes, Rakhi
              packaging and boxes for celebrations that deserve a beautiful
              beginning.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/collections/wedding"
                className="inline-flex items-center justify-center rounded-full bg-carbon px-7 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-carbon-dark"
              >
                Explore Cards
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-carbon/25 bg-white/50 px-7 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-carbon transition hover:border-carbon hover:bg-white"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="w-full">
            <div className="mx-auto max-w-xl rounded-[2rem] border border-carbon/10 bg-white p-4 shadow-[0_24px_80px_rgba(62,12,23,0.12)] lg:ml-auto">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-carbon via-maroon to-carbon-dark p-6 text-white sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-light">
                  {TAGLINE}
                </p>

                <div className="my-8 border-y border-white/15 py-8 sm:my-10 sm:py-10">
                  <p className="font-serif text-3xl leading-snug sm:text-4xl">
                    “A legacy that began with greetings now helps families
                    celebrate weddings, festivals and special moments
                    beautifully.”
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div
                      key={item.label}
                      className="min-h-[118px] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"
                    >
                      <p className="font-display text-2xl leading-none text-gold-light sm:text-3xl">
                        {item.value}
                      </p>
                      <p className="mt-3 text-xs uppercase leading-5 tracking-[0.16em] text-white/75">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand statement */}
      <section className="px-6 py-16 md:px-10 lg:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
            A legacy beyond ordinary invitations
          </p>

          <h2 className="mx-auto mt-4 max-w-4xl font-display text-3xl leading-tight text-carbon sm:text-4xl lg:text-5xl">
            From greeting cards to wedding cards, our story has always been
            about celebrations.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-ink-mid sm:text-lg">
            Beyond Invitation carries forward the heritage of Bharat Agency
            Wedding Cards Pvt. Ltd., a name that has been around for more than
            six decades. Over the years, the company expanded from greeting
            cards into wedding cards, and then into celebration essentials like
            shagun envelopes, Rakhi packaging and boxes. Every product we make
            is rooted in experience, trust and the joy of helping families mark
            important moments.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-paper px-6 py-16 md:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-carbon">
              Why choose us
            </p>

            <h2 className="mt-4 font-display text-3xl leading-tight text-carbon sm:text-4xl lg:text-5xl">
              Built on heritage, crafted for today.
            </h2>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {values.map((item) => (
              <article
                key={item.no}
                className="flex h-full flex-col rounded-[1.75rem] border border-carbon/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:p-8"
              >
                <p className="font-display text-4xl leading-none text-gold">
                  {item.no}
                </p>

                <h3 className="mt-6 font-display text-2xl leading-tight text-carbon">
                  {item.title}
                </h3>

                <p className="mt-4 flex-1 leading-7 text-ink-mid">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 py-16 md:px-10 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
              What we make
            </p>

            <h2 className="mt-4 font-display text-3xl leading-tight text-carbon sm:text-4xl lg:text-5xl">
              Stationery for weddings, festivals and special occasions.
            </h2>

            <p className="mt-5 leading-8 text-ink-mid">
              From wedding cards that announce a new beginning to shagun
              envelopes and Rakhi packaging that complete festive gifting, our
              collections are designed to bring elegance, tradition and
              presentation together.
            </p>

            <Link
              href="/collections/wedding"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-carbon px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-carbon-dark"
            >
              View Collection
            </Link>
          </div>

          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <div
                key={service}
                className="flex h-full flex-col rounded-3xl border border-carbon/10 bg-paper p-6"
              >
                <div className="mb-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-carbon text-gold-light">
                  ✦
                </div>

                <h3 className="font-display text-2xl leading-tight text-carbon">
                  {service}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-carbon px-6 py-16 text-white md:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-light">
              Simple process
            </p>

            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              From idea to invitation, beautifully managed.
            </h2>
          </div>

          <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((step, index) => (
              <article
                key={step.title}
                className="flex h-full flex-col rounded-[1.75rem] border border-white/15 bg-white/10 p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-light">
                  Step {index + 1}
                </p>

                <h3 className="mt-5 font-display text-3xl leading-tight">
                  {step.title}
                </h3>

                <p className="mt-4 flex-1 leading-7 text-white/75">
                  {step.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 md:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-carbon/10 bg-paper">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="p-6 sm:p-8 lg:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">
                Visit Beyond Invitation
              </p>

              <h2 className="mt-4 max-w-3xl font-display text-3xl leading-tight text-carbon sm:text-4xl lg:text-5xl">
                Let us help you choose the card that feels right.
              </h2>

              <p className="mt-5 max-w-2xl leading-8 text-ink-mid">
                Share your theme, function details, quantity and budget. Our
                team will help you shortlist suitable designs and guide you
                through customization, correction and delivery.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-carbon">
                    Location
                  </p>
                  <p className="mt-3 leading-7 text-ink-mid">
                    8, Jackson Lane, Canning Street, Kolkata - 700001
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-carbon">
                    Contact
                  </p>

                  <p className="mt-3 leading-7 text-ink-mid">
                    WhatsApp: +91 7044815488
                    <br />
                    Email: contact@khushionline.net
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full bg-carbon px-7 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-carbon-dark"
                >
                  Enquire Now
                </Link>

                <Link
                  href="/faq"
                  className="inline-flex items-center justify-center rounded-full border border-carbon/25 bg-white/50 px-7 py-3 text-center text-sm font-semibold uppercase tracking-[0.2em] text-carbon transition hover:border-carbon hover:bg-white"
                >
                  Read FAQs
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-center bg-gradient-to-br from-gold-pale via-white to-paper p-6 sm:p-8 lg:p-12">
              <div className="flex min-h-[360px] w-full max-w-md flex-col justify-between rounded-[1.75rem] border border-carbon/10 bg-white p-8 shadow-sm">
                <div>
                  <p className="font-display text-5xl leading-none text-carbon">
                    BI
                  </p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-gold">
                    Leave an impression
                  </p>
                </div>

                <div className="mt-16">
                  <p className="font-serif text-3xl leading-tight text-carbon sm:text-4xl">
                    Wedding cards, shagun envelopes and Rakhi packaging backed
                    by a 65+ year legacy.
                  </p>

                  <div className="mt-8 h-px bg-carbon/10" />

                  <p className="mt-6 text-sm leading-7 text-ink-mid">
                    Traditional. Modern. Elegant. Customised for your
                    celebration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}