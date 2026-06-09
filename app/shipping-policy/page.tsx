import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/components/siteConfig";

export const metadata: Metadata = {
    title: `Shipping Policy | ${BRAND}`,
    description:
        "Read the Refund Policy of Beyond Invitation, covering refund eligibility, order cancellations, non-refundable products, refund processing times, and customer responsibilities.",
};

const lastUpdated = "06 June 2026";

const sections = [
    {
        title: "1. Shipping Time",
        body: [
            <>
                <strong>For our manufactured cards without printing:</strong>
                <ul>
                    <li>It will take 3 to 4 days</li>
                </ul>
            </>,
            <>
                <strong>If printing is required, additional time is needed:</strong>
                <ul>
                    <li>During peak season: 10-12 days after matter approval</li>
                    <li>Off-season: Printing may be completed earlier, but we recommend planning your wedding card orders accordingly.</li>
                </ul>
            </>,
        ],
    },
    {
        title: "2. Shipping Days",
        body: [
            `Orders are processed and dispatched on business days, excluding Sundays and public holidays.`,
            `We work with trusted shipping partners to ensure secure and timely delivery of your purchases.`,
            `While we make every effort to ship all items in a single shipment, certain orders may be delivered separately due to stock availability, customization requirements, or operational considerations.`,
        ],
    },
    {
        title: "3. Receiving Your Order",
        body: [
            `If your package appears damaged, opened, or tampered with at the time of delivery, we recommend refusing the shipment and notifying our Customer Support team immediately.`,
            `Please provide your order reference number when contacting us.`,
            `Upon verification, a replacement will be arranged as soon as possible, subject to product availability.`,
        ],
    },
    {
        title: "4. Invoice & Pricing",
        body: [
            `All shipments will have an invoice with prices, as per Indian Tax Regulations.`,

        ],
    }
];

export default function ShippingPolicyPage() {
    return (
        <main className="min-h-screen bg-[#fffaf5]">
            {/* Hero */}
            <section className="border-b border-amber-100 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
                <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
                        Shipping Policy
                    </p>

                    <h1 className="max-w-3xl text-4xl font-serif font-semibold tracking-tight text-neutral-950 sm:text-5xl">
                        Shipping timelines and delivery information
                    </h1>

                    <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
                        This policy explains how {BRAND} processes, ships, and delivers orders, including estimated delivery timelines, shipping methods, order tracking, delivery responsibilities, and other important information related to the shipment of your purchases.

                    </p>

                    <div className="mt-8 rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm">
                        <p className="text-sm text-neutral-600">
                            <span className="font-semibold text-neutral-900">
                                Last Updated:
                            </span>{" "}
                            {lastUpdated}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-600">
                            Please read this Shipping Policy carefully before placing an order or requesting delivery-related assistance through our website or customer support channels.
                        </p>
                    </div>
                </div>
            </section>

            {/* Shipping Content */}
            <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
                <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
                    {/* Sidebar */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                                Contents
                            </p>

                            <nav className="space-y-2">
                                {sections.map((section) => (
                                    <a
                                        key={section.title}
                                        href={`#${section.title
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]+/g, "-")
                                            .replace(/(^-|-$)/g, "")}`}
                                        className="block rounded-lg px-3 py-2 text-sm text-neutral-700 transition hover:bg-amber-50 hover:text-amber-800"
                                    >
                                        {section.title}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Article */}
                    <article className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                        <div className="prose prose-neutral max-w-none">
                            <p className="text-base leading-8 text-neutral-700">
                                Welcome to <strong>{BRAND}</strong>. Your trust matters to us.
                                We collect only the information needed to provide a smooth
                                shopping, inquiry, customization, payment and delivery
                                experience.
                            </p>
                        </div>

                        <div className="mt-10 space-y-10">
                            {sections.map((section) => {
                                const id = section.title
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, "-")
                                    .replace(/(^-|-$)/g, "");

                                return (
                                    <section key={section.title} id={id} className="scroll-mt-28">
                                        <h2 className="font-serif text-2xl font-semibold text-neutral-950">
                                            {section.title}
                                        </h2>

                                        <div className="mt-4 space-y-4">
                                            {section.body.map((paragraph, index) => (
                                                <div
                                                    key={index}
                                                    className="text-sm leading-7 text-neutral-700 sm:text-base sm:leading-8"
                                                >
                                                    {paragraph}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>

                        {/* Contact Box */}
                        {/* <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
              <h2 className="font-serif text-2xl font-semibold text-neutral-950">
                Contact Us
              </h2>

              <p className="mt-4 text-sm leading-7 text-neutral-700 sm:text-base">
                For any questions regarding shipping, delivery timelines, order tracking, or shipment status, you may contact us:
              </p>

              <div className="mt-5 space-y-2 text-sm text-neutral-700 sm:text-base">
                <p>
                  <span className="font-semibold text-neutral-950">
                    Business:
                  </span>{" "}
                  {BRAND}
                </p>
                <p>
                  <span className="font-semibold text-neutral-950">
                    Address:
                  </span>{" "}
                  8, Jackson Lane, Canning Street, Kolkata - 700001
                </p>
                <p>
                  <span className="font-semibold text-neutral-950">
                    WhatsApp:
                  </span>{" "}
                  +91 7044815488
                </p>
                <p>
                  <span className="font-semibold text-neutral-950">
                    Email:
                  </span>{" "}
                  contact@khushionline.net
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Contact Us
                </Link>
              </div>
            </section> */}
                    </article>
                </div>
            </section>
        </main>
    );
}