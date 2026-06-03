// app/terms-and-conditions/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/components/siteConfig";

export const metadata: Metadata = {
  title: `Terms & Conditions | ${BRAND}`,
  description:
    "Read the Terms and Conditions of Beyond Invitation, covering website use, product orders, customization, payment, delivery, cancellation, refunds and customer responsibilities.",
};

const lastUpdated = "03 June 2026";

const sections = [
  {
    title: "1. Introduction",
    body: [
      `Welcome to ${BRAND}. These Terms and Conditions govern your use of our website, products, services, catalog, online ordering system, inquiry forms, payment options and communication channels.`,
      `By accessing our website, browsing products, creating an account, submitting an inquiry, placing an order, making payment, uploading artwork or communicating with us, you agree to follow these Terms and Conditions.`,
      `If you do not agree with these Terms and Conditions, please do not use our website or services.`,
    ],
  },
  {
    title: "2. About Our Products and Services",
    body: [
      `${BRAND} offers wedding invitations, shagun envelopes, rakhi packaging, invitation stationery, gifting-related packaging and other printed or customized products.`,
      `Products displayed on the website may include ready designs, catalog items, customizable products, made-to-order products and products that require manual confirmation before final production.`,
      `Some products may require design approval, size confirmation, text confirmation, printing confirmation, stock confirmation or production feasibility confirmation before order processing.`,
    ],
  },
  {
    title: "3. Website Use",
    body: [
      `You agree to use our website only for lawful purposes and in a manner that does not damage, disable, overload or impair the website or interfere with other users.`,
      `You must not misuse the website by attempting unauthorized access, introducing viruses, scraping data, copying product content without permission, or using the website for fraudulent activity.`,
      `We reserve the right to restrict, suspend or terminate access to the website if we believe a user has violated these Terms and Conditions or misused our services.`,
    ],
  },
  {
    title: "4. Account Registration",
    body: [
      `Some features of the website may require account registration or login. You agree to provide accurate, current and complete information while creating or using your account.`,
      `You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.`,
      `If you believe your account has been accessed without permission, you should contact us immediately.`,
    ],
  },
  {
    title: "5. Product Information",
    body: [
      `We try to display product details, images, descriptions, sizes, colors, prices and availability as accurately as possible. However, minor differences may occur due to screen settings, photography, lighting, printing process, material texture, production method or manual finishing.`,
      `Product images on the website are for reference and presentation purposes. The final product may vary slightly from the image shown on the website.`,
      `Any product size, paper quality, color shade, print effect, finishing, material, packaging or customization detail should be confirmed before final order approval, especially for bulk or customized orders.`,
    ],
  },
  {
    title: "6. Pricing and Availability",
    body: [
      `Product prices, discounts, offers and availability shown on the website may change without prior notice.`,
      `Prices may vary depending on quantity, customization, printing process, paper quality, finishing, packing, delivery location and special requirements.`,
      `If a product price is displayed incorrectly due to technical error, typing error, system error or catalog mismatch, we reserve the right to correct the price and confirm the revised price before processing the order.`,
      `Placing an inquiry or adding a product to cart does not guarantee product availability or final price confirmation.`,
    ],
  },
  {
    title: "7. Orders and Order Acceptance",
    body: [
      `An order is considered accepted only after we confirm the order details, product availability, customization requirements, payment status and production feasibility.`,
      `We reserve the right to accept, reject, cancel or request modification of any order for reasons including stock unavailability, incorrect pricing, incomplete information, payment failure, technical error, production limitation or violation of these Terms and Conditions.`,
      `For customized or bulk orders, production may begin only after design approval, text approval, advance payment or full payment, depending on the order type.`,
    ],
  },
  {
    title: "8. Customization and Design Approval",
    body: [
      `For customized products, you are responsible for providing correct names, dates, event details, spelling, addresses, language text, religious text, artwork, logo, images and other content required for printing or production.`,
      `Before production, we may share a design proof, preview, sample image or confirmation message for approval. Once you approve the design, text, layout, size or order specification, we are not responsible for errors that were present in the approved proof.`,
      `Changes requested after approval may lead to extra charges, delay in production or may not be possible if production has already started.`,
      `For printed products, slight variation in color, alignment, cutting, folding, pasting, finishing or material may occur due to production process and will not be treated as a defect unless the difference is substantial and clearly outside normal production tolerance.`,
    ],
  },
  {
    title: "9. Uploaded Content and Customer Responsibility",
    body: [
      `If you upload or share artwork, images, logos, photographs, invitation text, names, event details or any other content, you confirm that you have the legal right to use and share such content with us.`,
      `You agree that the content provided by you does not violate copyright, trademark, privacy, publicity, religious, cultural, legal or intellectual property rights of any third party.`,
      `We may refuse to print, process or fulfil any order containing content that we consider unlawful, offensive, misleading, infringing, inappropriate or against our business policy.`,
    ],
  },
  {
    title: "10. Payments",
    body: [
      `Payments may be accepted through online payment gateway, UPI, bank transfer, cash, card, wallet or any other payment method made available by us.`,
      `Online payments may be processed through third-party payment gateway providers such as Razorpay or similar payment partners.`,
      `Your order may not be processed until the required payment, advance payment or payment confirmation is received by us.`,
      `Payment failure, payment delay or incorrect payment reference may delay order processing. You should contact us if payment is deducted but the order is not confirmed.`,
    ],
  },
  {
    title: "11. Taxes and Invoices",
    body: [
      `Prices may be inclusive or exclusive of GST, taxes, delivery charges or other charges depending on the product, order type and invoice requirement.`,
      `If you require a GST invoice, you must provide correct GST details, business name, billing address and any other required information before invoice generation.`,
      `Once an invoice is generated, changes to billing details may not always be possible.`,
    ],
  },
  {
    title: "12. Delivery and Shipping",
    body: [
      `Delivery timelines are estimates and may vary depending on product availability, customization, production workload, payment confirmation, courier service, transport conditions, public holidays, weather, strikes, regional restrictions or events beyond our control.`,
      `We are not responsible for delays caused by courier companies, transport providers, incorrect address, unavailable recipient, natural events, government restrictions or circumstances beyond our reasonable control.`,
      `You are responsible for providing a complete and accurate delivery address, contact number and delivery instructions.`,
      `Risk of loss or damage may pass to the customer once the order is handed over to the courier, transporter or delivery partner, unless otherwise agreed in writing.`,
    ],
  },
  {
    title: "13. Cancellation",
    body: [
      `Cancellation requests must be made as early as possible. We may accept cancellation only if the order has not entered design, printing, production, packing or dispatch stage.`,
      `Customized, personalized, printed, made-to-order, specially sourced or bulk products may not be eligible for cancellation once processing or production has started.`,
      `If cancellation is accepted, refund eligibility will depend on order status, work already completed, payment gateway charges, design charges, material usage and other costs incurred.`,
    ],
  },
  {
    title: "14. Returns, Replacement and Refunds",
    body: [
      `Returns, replacements or refunds may be considered only for damaged, defective, wrong or materially different products, subject to verification by our team.`,
      `To raise a return or replacement request, you must contact us within the time period specified on our website or communicated at the time of order, along with order details, photographs, videos and a clear explanation of the issue.`,
      `Minor color variation, screen-to-print difference, slight cutting variation, minor finishing variation, paper shade difference, handmade variation or approved text/design error will not normally qualify for return, replacement or refund.`,
      `Customized or personalized products are generally not eligible for return unless there is a verified production error from our side.`,
      `Approved refunds, if any, will be processed through the original payment method or another suitable method as decided by us. Refund timelines may depend on banks, payment gateways and internal processing.`,
    ],
  },
  {
    title: "15. Product Quality and Production Variation",
    body: [
      `Printed and customized products may have small variations due to paper texture, ink behavior, machine settings, manual work, cutting, folding, pasting, lamination, die-cutting, foil, UV, embossing or other finishing processes.`,
      `Colors seen on mobile, laptop or desktop screens may not exactly match the final printed product because every screen displays colors differently.`,
      `For bulk orders, we recommend confirming all specifications before production. If required, you may request sample approval where available and applicable.`,
    ],
  },
  {
    title: "16. Offers and Discounts",
    body: [
      `Offers, discounts, coupon codes and promotional schemes are valid only for the period, products and conditions specified by us.`,
      `We reserve the right to modify, withdraw, cancel or refuse any offer, coupon or discount at any time without prior notice.`,
      `Offers may not be combined with other discounts unless clearly stated.`,
    ],
  },
  {
    title: "17. Intellectual Property",
    body: [
      `All website content, product images, product names, graphics, layouts, designs, logos, text, photographs, videos, icons, software, code and other materials are owned by or licensed to us unless otherwise stated.`,
      `You may not copy, reproduce, distribute, modify, sell, publish, upload, download, reverse engineer or commercially exploit any website content without our written permission.`,
      `Sharing product links for personal reference or purchase inquiry is allowed, but unauthorized commercial use of our content is strictly prohibited.`,
    ],
  },
  {
    title: "18. Third-Party Services",
    body: [
      `Our website may use third-party services for payment processing, authentication, analytics, hosting, delivery, communication, maps, social media or other features.`,
      `These third-party services may have their own terms, conditions and privacy policies. We are not responsible for the actions, policies, errors, downtime or services of third-party providers.`,
      `Your use of third-party services may be subject to their separate terms and conditions.`,
    ],
  },
  {
    title: "19. Limitation of Liability",
    body: [
      `To the maximum extent permitted by law, ${BRAND} shall not be liable for indirect, incidental, special, consequential or punitive damages arising from your use of the website, products or services.`,
      `We shall not be responsible for losses caused by incorrect information provided by you, payment gateway failure, courier delay, third-party service error, unauthorized account access, technical issues, natural events, production delay due to circumstances beyond our control or misuse of our products.`,
      `Our maximum liability, if any, shall be limited to the amount paid by you for the specific product or order giving rise to the claim.`,
    ],
  },
  {
    title: "20. Indemnity",
    body: [
      `You agree to indemnify and hold harmless ${BRAND}, its owners, employees, vendors, service providers and partners from any claims, losses, damages, liabilities, costs or expenses arising from your misuse of the website, violation of these Terms and Conditions, incorrect information, uploaded content, infringement of third-party rights or unlawful activity.`,
    ],
  },
  {
    title: "21. Force Majeure",
    body: [
      `We shall not be liable for delay or failure to perform any obligation due to events beyond our reasonable control, including natural disasters, fire, flood, epidemic, pandemic, strike, labour issue, transport disruption, government restriction, power failure, internet failure, supplier delay, courier delay, machine breakdown, war, civil disturbance or any other unforeseen event.`,
    ],
  },
  {
    title: "22. Privacy",
    body: [
      `Your use of our website is also governed by our Privacy Policy, which explains how we collect, use, store and protect your personal information.`,
      `Please read our Privacy Policy carefully before using our website or submitting personal information.`,
    ],
  },
  {
    title: "23. Governing Law and Jurisdiction",
    body: [
      `These Terms and Conditions shall be governed by and interpreted in accordance with the laws of India.`,
      `Subject to applicable law, disputes arising from these Terms and Conditions, website use, products, services or orders shall be subject to the jurisdiction of courts located in Kolkata, West Bengal, India.`,
    ],
  },
  {
    title: "24. Changes to These Terms",
    body: [
      `We may update these Terms and Conditions from time to time to reflect changes in our business, website, products, services, laws or policies.`,
      `When we update these Terms, we will revise the “Last Updated” date on this page.`,
      `Your continued use of our website after any changes means that you accept the updated Terms and Conditions.`,
    ],
  },
];

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5]">
      {/* Hero */}
      <section className="border-b border-amber-100 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
            Terms & Conditions
          </p>

          <h1 className="max-w-3xl text-4xl font-serif font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            Rules for using our website, products and services.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
            These Terms and Conditions explain the rules for browsing, ordering,
            customization, payments, delivery, cancellation, refunds and use of{" "}
            {BRAND} website content.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">
                Last Updated:
              </span>{" "}
              {lastUpdated}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Please read these Terms carefully before placing an order, making
              a payment, approving a design, or uploading artwork for
              customization.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
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
                These Terms and Conditions are a legal agreement between you and{" "}
                <strong>{BRAND}</strong>. They apply whenever you access our
                website, browse products, send inquiries, place orders, approve
                designs, upload files, make payments or use our services.
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
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-sm leading-7 text-neutral-700 sm:text-base sm:leading-8"
                        >
                          {paragraph}
                        </p>
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
                For questions about these Terms and Conditions, order policies,
                cancellation, refund, customization or delivery, you may contact
                us:
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
                  <span className="font-semibold text-neutral-950">Email:</span>{" "}
                  sales@beyondinvitation.com
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
                >
                  Contact Us
                </Link>

                <Link
                  href="/privacy-policy"
                  className="rounded-full border border-amber-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-amber-100"
                >
                  Privacy Policy
                </Link>
              </div>
            </section>
          </article>
        </div>
      </section>
    </main>
  );
}
