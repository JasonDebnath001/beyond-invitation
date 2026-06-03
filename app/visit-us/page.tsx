import type { Metadata } from "next";
import Link from "next/link";

const store = {
  name: "Bharat Agency Wedding Cards PVT. LTD.",
  address:
    "Shop No. 8, Indra Kumar Karnani St, China Bazar, B.B.D. Bagh, Kolkata, West Bengal 700001",
  phone: "7044815488",
  whatsapp: "917044815488",
  hours: "Monday to Saturday, 10:00 AM – 7:00 PM",
};

const mapQuery = `${store.name}, ${store.address}`;

const googleMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
  mapQuery
)}&output=embed`;

const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  mapQuery
)}`;

const whatsappUrl = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(
  "Hi Beyond Invitation, I want to visit your store. Please share details."
)}`;

export const metadata: Metadata = {
  title: "Visit Us | Beyond Invitation",
  description:
    "Visit Beyond Invitation at Bharat Agency Wedding Cards PVT. LTD., Kolkata. Explore premium wedding cards, shagun envelopes, rakhi packaging, and invitation stationery.",
};

export default function VisitUsPage() {
  return (
    <main className="bg-white text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,28,46,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(201,168,76,0.18),transparent_32%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit rounded-full border border-carbon/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-carbon">
              Visit Our Kolkata Store
            </p>

            <h1 className="font-display text-4xl font-semibold tracking-tight text-carbon sm:text-5xl lg:text-6xl">
              See the cards, feel the paper, choose with confidence.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-ink-mid sm:text-lg">
              Visit Beyond Invitation at Bharat Agency Wedding Cards PVT. LTD.
              in Kolkata to explore wedding cards, shagun envelopes, rakhi
              packaging, premium stationery, samples, finishes, and custom
              options in person.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={googleDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-carbon px-7 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-carbon-dark"
              >
                Get Directions
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-carbon/25 bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-carbon transition hover:bg-carbon hover:text-white"
              >
                WhatsApp Us
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-carbon/10 bg-white p-4 shadow-xl shadow-carbon/10">
            <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-paper">
              <iframe
                title="Beyond Invitation Store Location"
                src={googleMapEmbedUrl}
                width="100%"
                height="100%"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>

            <div className="mt-4 rounded-[1.25rem] bg-paper p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-carbon">
                Store Location
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-carbon">
                {store.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-mid">
                {store.address}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard
            eyebrow="Call / WhatsApp"
            title={store.phone}
            body="Connect with us before visiting for availability, product categories, bulk enquiries, and custom card requirements."
            href={whatsappUrl}
            cta="Message Now"
            external
          />

          <InfoCard
            eyebrow="Store Hours"
            title={store.hours}
            body="Best time to visit is during business hours, especially if you want to compare samples and discuss customization."
          />

          <InfoCard
            eyebrow="Landmark Area"
            title="China Bazar, B.B.D. Bagh"
            body="Located in central Kolkata, close to the wedding card and stationery market area."
            href={googleDirectionsUrl}
            cta="Open Map"
            external
          />
        </div>
      </section>

      {/* Visit Experience */}
      <section className="bg-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-carbon">
              What you can explore
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-carbon sm:text-4xl">
              A better way to select invitation stationery.
            </h2>
            <p className="mt-5 text-base leading-8 text-ink-mid">
              Online photos help, but wedding cards are best selected by seeing
              the paper, texture, size, color, finish, and print quality in
              person. At the store, customers can compare options side by side
              and discuss custom requirements.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Wedding card samples",
              "Shagun envelopes",
              "Rakhi packaging",
              "Budget and premium ranges",
              "Paper and color selection",
              "Bulk order discussion",
              "Custom design guidance",
              "Printing and finishing options",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-carbon/10 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-carbon/10 text-carbon">
                  ✓
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-carbon">
                  {item}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-carbon px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
              Planning a visit?
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold">
              Come with your theme, budget, and quantity.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
              Our team can help you shortlist the right invitation cards and
              packaging options based on your event style, timeline, and budget.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <a
              href={googleDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-carbon transition hover:bg-paper"
            >
              Navigate
            </a>

            <Link
              href="/collections/wedding-card"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white hover:text-carbon"
            >
              Browse Cards
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  eyebrow,
  title,
  body,
  href,
  cta,
  external = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
  external?: boolean;
}) {
  const content = (
    <div className="h-full rounded-[1.5rem] border border-carbon/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-carbon/10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-carbon">
        {eyebrow}
      </p>
      <h3 className="mt-3 font-display text-2xl font-semibold text-carbon">
        {title}
      </h3>
      <p className="mt-4 text-sm leading-7 text-ink-mid">{body}</p>

      {href && cta && (
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-carbon">
          {cta} →
        </p>
      )}
    </div>
  );

  if (!href) return content;

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="block h-full"
    >
      {content}
    </a>
  );
}