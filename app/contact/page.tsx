import type { Metadata } from "next";
import Link from "next/link";
import { ContactMotion } from "@/components/contact/ContactMotion";
import ContactChannels from "@/components/contact/ContactChannels";
import EnquiryForm from "@/components/contact/EnquiryForm";
import { fetchErpProductBySlug } from "@/lib/catalog";
import type { EnquiryProduct } from "@/lib/contact";
import { siteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact Us | Beyond Invitation",
  description:
    "Get in touch with Beyond Invitation for wedding invitations, shagun envelopes, rakhi packaging, and celebration stationery.",
  alternates: { canonical: "/contact" },
  openGraph: { url: siteUrl("/contact") },
};

export default async function ContactPage({ searchParams }: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const params = await searchParams;
  const slug = typeof params.product === "string" ? params.product.trim() : "";
  let enquiryProduct: EnquiryProduct | null = null;

  if (slug) {
    try {
      const product = await fetchErpProductBySlug(slug);
      if (product) {
        enquiryProduct = {
          slug: product.slug,
          designNo: product.itemCode || product.slug,
          name: product.name,
          image: product.images[0] || null,
          subject: product.subject,
          minOrderQty: product.minOrderQty,
        };
      }
    } catch {
      // A catalogue outage must never prevent a customer from contacting us.
    }
  }

  return (
    <ContactMotion>
      <section className="relative px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-[#dcb162]/10 blur-3xl" />
        <div className="relative mx-auto grid min-w-0 max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="min-w-0">
            <p data-motion="eyebrow" className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#a7772d]">Contact</p>
            <h1 className="mt-4 text-[34px] font-light leading-[1.08] tracking-[-0.035em] text-[#50101f] lg:text-[52px]">
              {"Tell us about your celebration.".split(" ").map((word, index) => (
                <span key={word}>{index > 0 ? " " : ""}<span data-motion="heading-word" className="inline-block">{word}</span></span>
              ))}
            </h1>
            <p data-motion="intro" className="mt-5 text-base leading-8 text-ink-mid">Wedding cards, shagun envelopes, rakhi packaging or a custom design — send the details and our team will call or message you back.</p>
            <div data-header-rule className="my-8 h-px bg-gradient-to-r from-gold via-gold/40 to-transparent" />
            <ContactChannels enquiryProduct={enquiryProduct} />
            <aside className="mt-6 rounded-2xl border border-gold/20 bg-white/80 px-5 py-4 shadow-[0_1px_0_rgba(201,168,76,0.25),0_18px_40px_-28px_rgba(80,16,31,0.35)]">
              <h2 className="font-semibold text-carbon">Already placed an order?</h2>
              <p className="mt-1 text-sm leading-6 text-ink-mid">Message us on WhatsApp with your payment reference.</p>
              <Link href="/my-orders" className="mt-2 inline-block text-sm font-semibold text-carbon underline decoration-gold/50 underline-offset-4 hover:decoration-carbon">Order help</Link>
            </aside>
          </div>
          <div data-motion="form-card" className="order-first min-w-0 rounded-3xl border border-gold/20 bg-white p-6 shadow-[0_1px_0_rgba(201,168,76,0.25),0_18px_40px_-28px_rgba(80,16,31,0.35)] sm:p-8 lg:order-none lg:sticky lg:top-28 lg:self-start">
            <EnquiryForm key={enquiryProduct?.slug || "general"} enquiryProduct={enquiryProduct} />
          </div>
        </div>
      </section>
    </ContactMotion>
  );
}
