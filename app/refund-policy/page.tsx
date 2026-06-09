import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/components/siteConfig";

export const metadata: Metadata = {
  title: `Refund Policy | ${BRAND}`,
  description:
    "Read the Refund Policy of Beyond Invitation, covering refund eligibility, order cancellations, non-refundable products, refund processing times, and customer responsibilities.",
};

const lastUpdated = "06 June 2026";

const sections = [
  {
    title: "1. Cancellation Policy",
    body: [
      `${BRAND} does not encourage the cancellation of orders once they have been placed. However, certain cancellation requests may be considered under specific circumstances.`,
      'A cancellation request may be eligible for review if the same order for the same product and quantity has been placed more than once by the customer within a 24-hour period.',
      'Cancellation requests must be submitted within 12 hours of placing the order. Requests received after this period, or after the order has been processed or shipped, may not be accepted.',
    ],
  },
  {
    title: "2. Exchange Policy",
    body: [
      'Product exchanges may be approved only in specific circumstances, including when an incorrect product has been delivered to the customer.',
      'An exchange may also be considered if the delivered product is damaged and an identical replacement product is unavailable due to being out of stock.',
      'Customers must report any eligible exchange issues within a reasonable period after delivery and provide sufficient details or evidence to support the request.',
      'No cancellation, return, refund, or exchange requests will be accepted for custom-made products, personalized items, printed products, or any order specifically manufactured according to customer requirements.',
    ]
  },
  {
    title: "3. Refund",
    body: [
      `The refund will be processed for the canceled orders only. Refunds shall be processed within 21 working days from the date of refund confirmation`,
    ],
  },

  {
    title: "5. No Returns or Exchanges",
    body: [
      <><strong>Customized Products:</strong> All custom wedding cards and personalized products are made to order and tailored to your specifications. As such, we do not accept returns or exchanges on any customized items, including printed, embossed, or engraved products.</>,
      <><strong>Non-Customized Products:</strong> We also do not accept returns or exchanges on non-customized products. Once an order is placed, it is considered final.</>,
    ],
  },
  {
    title: "6. Quality Assurance",
    body: [
      `We are committed to ensuring the highest quality standards for our products.`,
      `Each item undergoes a thorough quality check before it is dispatched to you.`,
      `If you receive a product that is damaged or defective, please refer to the section below.`,
    ],
  },
  {
    title: "7. Damaged or Defective Products",
    body: [
      'Although we generally do not accept product returns, we are committed to resolving issues arising from manufacturing defects, shipping damage, or fulfillment errors where applicable.',
      'If you receive a damaged, defective, or incorrect item, you should notify our customer support team within 48 hours of delivery. To help us investigate the issue, please provide your order details along with clear photographs showing the problem.',
      'Our team will carefully review the submitted information and determine the most appropriate resolution. Where approved, we may arrange a replacement product at no additional charge, provided the item has not been printed or customized beyond correction.',
      'In exceptional circumstances where a replacement is not feasible, a refund may be considered based on the findings of our internal review and investigation process.',
    ]
  },
  {
    title: "8. Order Cancellations",
    body: [
      `Once an order has been processed or shipped, it cannot be cancelled or refunded.`,
    ],
  },
  {
    title: "9. Customer Support",
    body: [
      <>If you have any questions or enquiry about our return policy, please reach out to our customer support team at <strong>contact@khushionline.net</strong> or call us at <strong>+91 7044815488</strong>.</>,
      `We are always here for yourr help.`,

    ],
  }
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5]">
      {/* Hero */}
      <section className="border-b border-amber-100 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
            Refund Policy
          </p>

          <h1 className="max-w-3xl text-4xl font-serif font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            How the refund and exchange policy works
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
            This policy explains how {BRAND} handles refund requests, order cancellations, eligibility requirements, non-refundable products, refund processing timelines, and customer responsibilities when purchasing our products or services.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">
                Last Updated:
              </span>{" "}
              {lastUpdated}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Please read this Refund Policy carefully before placing an order, requesting a cancellation, or submitting a refund request through our website or services.
            </p>
          </div>
        </div>
      </section>

      {/* Refund Content */}
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
            <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
              <h2 className="font-serif text-2xl font-semibold text-neutral-950">
                Contact Us
              </h2>

              <p className="mt-4 text-sm leading-7 text-neutral-700 sm:text-base">
                For refund requests, cancellation inquiries, exchange requests, damaged product claims, or any concerns related to your order, you may contact us:
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
            </section>
          </article>
        </div>
      </section>
    </main>
  );
}