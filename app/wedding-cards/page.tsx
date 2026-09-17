import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { WeddingCardsMotion } from "@/components/wedding-cards/WeddingCardsMotion";
import WeddingCardsBrowser, {
  WeddingCardsSkeleton,
} from "@/components/wedding-cards/WeddingCardsBrowser";
import WeddingCardsFaq from "@/components/wedding-cards/WeddingCardsFaq";
import { fetchWeddingCardProducts, type CatalogProduct } from "@/lib/catalog";
import { WEDDING_FAQS, type BrowserProduct } from "@/lib/wedding-cards";
import {
  BUSINESS_ADDRESS,
  DEFAULT_OG_IMAGE,
  PRIMARY_KEYWORDS,
  SITE_DESCRIPTION,
  SITE_NAME,
  getSiteUrl,
  siteUrl,
} from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 60;
const pageUrl = siteUrl("/wedding-cards");
const title =
  "Wedding Cards in Kolkata | Wedding Invitation Cards Online India";
const description =
  "Explore premium wedding cards in Kolkata from Beyond Invitation. Shop Hindu, Muslim, Christian and designer Indian wedding invitation cards with pan-India delivery.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title,
  description,
  keywords: PRIMARY_KEYWORDS,
  alternates: { canonical: "/wedding-cards" },
  openGraph: {
    title,
    description,
    url: pageUrl,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Beyond Invitation wedding cards in Kolkata",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function WeddingCardsPage() {
  let products: CatalogProduct[] = [];
  try {
    products = await fetchWeddingCardProducts();
  } catch (error) {
    console.error("Wedding cards page Catalogue fetch failed:", error);
  }
  const browserProducts: BrowserProduct[] = products.map((product) => ({
    slug: product.slug,
    designNo: product.itemCode || product.slug,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    image: product.images[0] || "",
    imageCount: product.images.length,
    subject: product.subject,
    itemGroup: product.itemGroup,
    hasPrice: product.hasPrice,
    minOrderQty: product.minOrderQty,
    updatedAt: product.updatedAt,
  }));
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getSiteUrl()}/#localbusiness`,
    name: SITE_NAME,
    url: getSiteUrl(),
    image: siteUrl(DEFAULT_OG_IMAGE),
    description: SITE_DESCRIPTION,
    priceRange: "₹₹",
    address: { "@type": "PostalAddress", ...BUSINESS_ADDRESS },
    areaServed: [
      { "@type": "City", name: "Kolkata" },
      { "@type": "State", name: "West Bengal" },
      { "@type": "Country", name: "India" },
    ],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Wedding Cards",
          category: "Wedding Invitation Cards",
        },
      },
    ],
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
      {
        "@type": "ListItem",
        position: 2,
        name: "Wedding Cards",
        item: pageUrl,
      },
    ],
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Wedding cards by Beyond Invitation",
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: siteUrl(`/products/${product.slug}`),
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description || description,
        image: siteUrl(product.images[0] || DEFAULT_OG_IMAGE),
        url: siteUrl(`/products/${product.slug}`),
        offers:
          product.price > 0
            ? {
                "@type": "Offer",
                priceCurrency: "INR",
                price: product.price,
                availability: "https://schema.org/InStock",
              }
            : undefined,
      },
    })),
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: WEDDING_FAQS.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  const primary =
    "inline-flex items-center justify-center rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-carbon-dark";
  const secondary =
    "inline-flex items-center justify-center rounded-full border border-carbon/20 bg-white px-6 py-3 text-sm font-semibold text-carbon transition-colors hover:bg-paper";

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />
      <WeddingCardsMotion>
        <section id="collection" aria-labelledby="wedding-cards-title" className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <header className="mb-3 sm:mb-5">
            <h1 id="wedding-cards-title" className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-maroon sm:text-[32px]">Wedding cards</h1>
          </header>
          {products.length ? (
            <Suspense fallback={<WeddingCardsSkeleton />}>
              <WeddingCardsBrowser products={browserProducts} />
            </Suspense>
          ) : (
            <div className="rounded-3xl border border-gold/20 bg-white/80 p-12 text-center">
              <h3 className="text-2xl font-light text-maroon">
                Unable to load wedding cards.
              </h3>
              <p className="mt-3 text-base leading-8 text-ink-mid">
                Please try again, or contact us for available designs.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a
                  href="https://wa.me/917044815488"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={primary}
                >
                  Chat on WhatsApp
                </a>
                <Link href="/contact" className={secondary}>
                  Contact us
                </Link>
              </div>
            </div>
          )}
        </section>
        <WeddingCardsFaq />
      </WeddingCardsMotion>
    </>
  );
}
