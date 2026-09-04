import type { Metadata } from "next";
import Link from "next/link";
import ContactLeadForm from "@/components/ContactLeadForm";
import { siteUrl } from "@/lib/site-config";

const phoneNumber = "7044815488";
const displayPhone = "+91 70448 15488";
const placeholderEmail = "contact@khushionline.net";

export const metadata: Metadata = {
  title: "Contact Us | Beyond Invitation",
  description:
    "Get in touch with Beyond Invitation for wedding invitations, shagun envelopes, rakhi packaging, and celebration stationery.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    url: siteUrl("/contact"),
  },
};

export default function ContactPage() {
  return (
    <main className="bg-white">
      {/* Hero with enquiry form visible above the fold */}
      <section className="relative overflow-hidden bg-paper">
        <div className="mx-auto grid min-w-0 max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8 lg:py-20">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-carbon">
              Contact Us
            </p>

            <h1 className="mt-5 break-words font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Let&apos;s create something beautiful for your celebration.
            </h1>

            <p className="mt-6 text-base leading-8 text-ink-mid sm:text-lg">
              Whether you&apos;re looking for wedding invitations, shagun
              envelopes, rakhi packaging, or celebration stationery, our team
              is here to help you choose the right product.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`https://wa.me/91${phoneNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition hover:bg-carbon-dark"
              >
                Chat on WhatsApp
              </Link>

              <Link
                href={`tel:+91${phoneNumber}`}
                className="inline-flex items-center justify-center rounded-full border border-carbon/20 bg-white px-6 py-3 text-sm font-semibold text-carbon transition hover:border-carbon"
              >
                Call Now
              </Link>
            </div>
          </div>

          <div className="min-w-0 rounded-[2rem] border border-carbon/10 bg-white p-5 shadow-[0_20px_70px_rgba(62,12,23,0.12)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-carbon">
              Enquiry Form
            </p>

            <h2 className="mt-4 font-display text-3xl font-semibold text-ink">
              Send us your requirement
            </h2>

            <ContactLeadForm />
          </div>
        </div>
      </section>

      {/* Contact details */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-carbon">
            Reach Us
          </p>

          <h2 className="mt-4 font-display text-3xl font-semibold text-ink">
            Speak with our team
          </h2>

          <p className="mt-4 text-sm leading-7 text-ink-mid">
            For quick product queries, catalogue assistance, or order
            support, call or message us directly.
          </p>
        </div>

        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 rounded-3xl border border-carbon/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-light">
              Phone
            </p>

            <Link
              href={`tel:+91${phoneNumber}`}
              className="mt-2 block text-xl font-semibold text-carbon transition hover:text-carbon-dark"
            >
              {displayPhone}
            </Link>
          </div>

          <div className="min-w-0 rounded-3xl border border-carbon/10 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-light">
              WhatsApp
            </p>

            <Link
              href={`https://wa.me/91${phoneNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-full bg-carbon px-5 py-3 text-sm font-semibold text-white transition hover:bg-carbon-dark"
            >
              Chat on WhatsApp
            </Link>
          </div>

          <div className="min-w-0 rounded-3xl border border-carbon/10 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-light">
              Email
            </p>

            <Link
              href={`mailto:${placeholderEmail}`}
              className="mt-2 block break-all text-base font-semibold text-carbon transition hover:text-carbon-dark sm:text-lg"
            >
              {placeholderEmail}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
