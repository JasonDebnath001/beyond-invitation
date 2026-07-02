// app/visit-us/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/components/siteConfig";
import { siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Visit Us | ${BRAND}`,
  description:
    "Visit Beyond Invitation / Bharat Agency Wedding Cards Pvt. Ltd. at 8, Jackson Lane, Canning Street, Kolkata - 700001.",
  alternates: {
    canonical: "/visit-us",
  },
  openGraph: {
    url: siteUrl("/visit-us"),
  },
};

export default function VisitUsPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5]">
      <section className="border-b border-amber-100 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-20">
          {/* Text */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
              Visit Us
            </p>

            <h1 className="max-w-3xl font-serif text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
              Experience our wedding card collection in person.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-700 sm:text-lg">
              Visit our Kolkata showroom to explore wedding cards, rakhi cards,
              tags, boxes and fancy money envelopes. Our team will help you
              choose designs, understand finishes and plan the right invitation
              for your celebration.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Address
                </p>
                <p className="mt-3 text-base leading-7 text-neutral-800">
                  8, Jackson Lane,
                  <br />
                  Canning Street,
                  <br />
                  Kolkata - 700001
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Contact
                </p>
                <p className="mt-3 text-base leading-7 text-neutral-800">
                  WhatsApp: +91 7044815488
                  <br />
                  Phone: 033-22428918
                  <br />
                  contact@khushionline.net
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="https://wa.me/917044815488"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
              >
                Chat on WhatsApp
              </Link>

              <Link
                href="https://www.google.com/maps/search/?api=1&query=8%20Jackson%20Lane%20Canning%20Street%20Kolkata%20700001"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-amber-100"
              >
                Open in Google Maps
              </Link>
            </div>
          </div>

          {/* Storefront Image */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-amber-200/30 blur-2xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-amber-100 bg-white p-3 shadow-xl">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[1.5rem]">
                <Image
                  src="/visit-us/bharat-agency-storefront.jpg"
                  alt="Bharat Agency Wedding Cards Pvt. Ltd. storefront in Kolkata"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 430px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/60 bg-white/90 p-4 shadow-lg backdrop-blur">
              <p className="text-sm font-semibold text-neutral-950">
                Bharat Agency Wedding Cards Pvt. Ltd.
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                Distributor of Khushi Wedding Cards, Rakhi Cards, Tags, Boxes &
                Fancy Money Envelopes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
                Find Us
              </p>

              <h2 className="mt-3 font-serif text-3xl font-semibold text-neutral-950">
                Easy to reach from Canning Street, Kolkata.
              </h2>

              <p className="mt-4 text-base leading-8 text-neutral-700">
                You can visit our showroom for catalog viewing, product
                selection, bulk order discussion and custom wedding card
                requirements.
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-5">
              <p className="text-sm font-semibold text-neutral-950">
                Showroom Details
              </p>

              <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
                <p>
                  <span className="font-semibold text-neutral-950">
                    Business:
                  </span>{" "}
                  Bharat Agency Wedding Cards Pvt. Ltd.
                </p>
                <p>
                  <span className="font-semibold text-neutral-950">
                    Location:
                  </span>{" "}
                  8, Jackson Lane, Kolkata - 700001
                </p>
                <p>
                  <span className="font-semibold text-neutral-950">
                    Contact:
                  </span>{" "}
                  +91 7044815488
                </p>
              </div>

              <Link
                href="/contact"
                className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
              >
                Send Enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}