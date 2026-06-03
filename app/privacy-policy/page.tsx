// app/privacy-policy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/components/siteConfig";

export const metadata: Metadata = {
  title: `Privacy Policy | ${BRAND}`,
  description:
    "Read the Privacy Policy of Beyond Invitation, covering how we collect, use, store and protect customer information, order details, payment information, cookies and communication data.",
};

const lastUpdated = "03 June 2026";

const sections = [
  {
    title: "1. Introduction",
    body: [
      `${BRAND} respects your privacy and is committed to protecting the personal information you share with us when you visit our website, browse products, create an account, place an order, make a payment, contact us, or interact with us through phone, WhatsApp, email, social media or any other channel.`,
      `This Privacy Policy explains what information we collect, why we collect it, how we use it, how we share it, how long we keep it, and what choices you have regarding your personal information.`,
      `By using our website or services, you agree to the collection and use of information in accordance with this Privacy Policy.`,
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      `We may collect personal information that you voluntarily provide to us, including your name, mobile number, WhatsApp number, email address, billing address, shipping address, city, state, PIN code, company name, GST details, order requirements, product preferences, design details and any other information you submit through our website or communication channels.`,
      `When you place an order or inquiry, we may collect order-related information such as selected products, quantity, size, color, material, customization details, delivery instructions, quotation details, invoice details, payment status, delivery status, cancellation details, refund details and customer remarks.`,
      `If you upload or share artwork, logos, photographs, invitation text, event details, names, family details or reference designs, we may collect and process those files only for order processing, design customization, proofing, printing, correction, delivery and customer support.`,
      `We may also automatically collect technical information such as IP address, browser type, device type, operating system, pages visited, time spent on the website, referring source, approximate location, cookies, session data and similar website usage information.`,
    ],
  },
  {
    title: "3. How We Use Your Information",
    body: [
      `We use your information to operate our website, display products, process inquiries, prepare quotations, create and manage accounts, process orders, customize designs, prepare invoices, coordinate production, arrange delivery, provide customer support and communicate order updates.`,
      `We may use your contact details to communicate with you through phone, WhatsApp, SMS, email or other channels for order confirmation, design approval, payment confirmation, delivery updates, product availability, service support, feedback and promotional updates.`,
      `We may use website usage data to improve website performance, fix technical issues, understand customer preferences, improve product categories, improve search and filtering, prevent fraud and maintain website security.`,
      `We may use your information for internal business operations including ERP, CRM, inventory management, accounting, reporting, staff coordination, vendor coordination, job-work management, quality control and legal compliance.`,
    ],
  },
  {
    title: "4. Payments and Transaction Data",
    body: [
      `Online payments on our website may be processed through third-party payment gateway providers such as Razorpay or similar authorized payment partners.`,
      `We may receive limited payment-related information such as payment status, transaction ID, payment reference number, order amount, refund status and payment method type.`,
      `We do not store complete debit card numbers, credit card numbers, CVV, UPI PIN, net banking passwords or sensitive banking credentials on our website servers.`,
      `Payment gateway providers process your payment information according to their own security standards, terms and privacy policies. We recommend reviewing their policies before completing payment.`,
    ],
  },
  {
    title: "5. Account and Authentication",
    body: [
      `If our website allows account login, we may collect and process information required to create, authenticate and manage your account, including your name, email address, mobile number, login identifier, account activity, order history and session information.`,
      `Authentication may be managed through third-party authentication services. Such providers may process your information according to their own privacy practices.`,
      `You are responsible for keeping your login credentials confidential and for all activity that occurs under your account.`,
    ],
  },
  {
    title: "6. Cookies and Tracking Technologies",
    body: [
      `Our website may use cookies, local storage, session storage, pixels, tags and similar technologies to provide essential website functions, remember cart items, keep you logged in, improve performance, understand visitor behavior and measure marketing effectiveness.`,
      `Some cookies are necessary for the website to function properly. Others may be used for analytics, preferences and marketing.`,
      `You can control or disable cookies through your browser settings. However, disabling cookies may affect features such as login, cart, checkout, product recommendations and personalized browsing.`,
    ],
  },
  {
    title: "7. Sharing of Information",
    body: [
      `We do not sell your personal information. However, we may share necessary information with trusted service providers and business partners who help us operate our website and fulfil customer orders.`,
      `This may include website hosting providers, payment gateway providers, authentication providers, ERP or CRM systems, accounting systems, email and SMS providers, WhatsApp communication providers, analytics providers, cloud storage providers, IT support providers, designers, production teams, vendors, job workers, courier partners and logistics partners.`,
      `For customized products, we may share required artwork, text, design instructions, names, event details and order specifications with internal teams or external vendors involved in design, printing, finishing, packing or delivery.`,
      `We may also disclose information if required by law, court order, government request, tax regulation, legal proceeding, fraud prevention, security investigation or to protect our legal rights.`,
    ],
  },
  {
    title: "8. Uploaded Files, Artwork and Custom Designs",
    body: [
      `When you upload or send us artwork, logos, photographs, invitation wording, family names, religious text, event details or design references, we use such content only for purposes connected with your inquiry or order.`,
      `You confirm that you have the right to share such content with us and that it does not violate any copyright, trademark, privacy, publicity, intellectual property or other third-party rights.`,
      `We may retain design files, order proofs and customization details for future corrections, reprints, repeat orders, customer support, accounting records and internal business reference unless deletion is requested and legally or operationally possible.`,
    ],
  },
  {
    title: "9. Data Security",
    body: [
      `We take reasonable technical, administrative and organizational measures to protect your personal information against unauthorized access, misuse, loss, alteration, disclosure or destruction.`,
      `These measures may include secure website protocols, access controls, password protection, restricted staff access, secure hosting, system monitoring, backup processes and use of secure third-party payment gateways.`,
      `However, no method of transmission over the internet or electronic storage is completely secure. Therefore, while we try to protect your information, we cannot guarantee absolute security.`,
    ],
  },
  {
    title: "10. Data Retention",
    body: [
      `We retain personal information only for as long as necessary for the purposes described in this Privacy Policy, unless a longer retention period is required or permitted by law.`,
      `We may retain order records, invoice records, payment records, tax records, delivery records, design approvals, communication history and support records for accounting, legal compliance, dispute resolution, reorders, fraud prevention and business purposes.`,
      `Uploaded artwork and customization details may be retained for future correction, repeat orders, reprints, customer support or production reference unless deletion is requested and such deletion is possible under applicable law and business requirements.`,
    ],
  },
  {
    title: "11. Marketing Communication",
    body: [
      `We may send you updates, offers, new collection announcements, product recommendations and promotional messages through WhatsApp, SMS, email, phone or social media, where permitted by law or based on your interaction with us.`,
      `You may request to stop receiving promotional communication by contacting us or using any opt-out method provided in the message.`,
      `Even after opting out of marketing messages, we may still send important transactional or service-related messages such as order confirmation, payment updates, delivery updates, design approval requests and customer support responses.`,
    ],
  },
  {
    title: "12. Your Rights",
    body: [
      `Subject to applicable law, you may request access to your personal information, correction of inaccurate information, withdrawal of consent, deletion of information, or restriction of certain processing activities.`,
      `To protect your privacy and security, we may need to verify your identity before processing such requests.`,
      `We may refuse or limit a request where permitted by law, including where information is required for tax records, legal compliance, fraud prevention, dispute resolution, order completion, accounting or legitimate business purposes.`,
    ],
  },
  {
    title: "13. Third-Party Links and Services",
    body: [
      `Our website may contain links to third-party websites, payment pages, courier tracking pages, social media pages or external platforms.`,
      `We are not responsible for the privacy practices, security, content or policies of third-party websites and services that we do not own or control.`,
      `You should review the privacy policies of third-party platforms before sharing personal information with them.`,
    ],
  },
  {
    title: "14. Children’s Privacy",
    body: [
      `Our website and services are intended for customers who are capable of entering into commercial transactions.`,
      `We do not knowingly collect personal information from children without appropriate consent from a parent or guardian, where required by law.`,
      `If you believe that a child has provided personal information to us without proper consent, please contact us so that we can take appropriate action.`,
    ],
  },
  {
    title: "15. Changes to This Privacy Policy",
    body: [
      `We may update this Privacy Policy from time to time to reflect changes in our business, website, technology, legal requirements or privacy practices.`,
      `When we update this Privacy Policy, we will revise the “Last Updated” date on this page.`,
      `Your continued use of our website after any changes means that you accept the updated Privacy Policy.`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5]">
      {/* Hero */}
      <section className="border-b border-amber-100 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">
            Privacy Policy
          </p>

          <h1 className="max-w-3xl text-4xl font-serif font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            How we collect, use and protect your information.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-700 sm:text-lg">
            This policy explains how {BRAND} handles customer information,
            order details, payment references, uploaded artwork, cookies and
            communication data when you use our website or services.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">
                Last Updated:
              </span>{" "}
              {lastUpdated}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Please read this Privacy Policy carefully before using our website,
              placing an order, uploading artwork or sharing personal details.
            </p>
          </div>
        </div>
      </section>

      {/* Policy Content */}
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
                For privacy-related questions, correction requests, deletion
                requests, order data concerns or complaints, you may contact us:
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