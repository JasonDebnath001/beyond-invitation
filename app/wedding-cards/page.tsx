import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";
import { fetchWeddingCardsWithCategories, type CategorizedCatalogProduct } from "@/lib/catalog-item-category";
import { WEDDING_FAQS } from "@/lib/wedding-cards";
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
  let products: CategorizedCatalogProduct[] = [];
  let errorMessage = "";
  try {
    products = await fetchWeddingCardsWithCategories();
  } catch (error) {
    console.error("Wedding cards page Catalogue fetch failed:", error);
    errorMessage = "Unable to load wedding cards.";
  }
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

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={itemListJsonLd} />
      <JsonLd data={faqJsonLd} />
      <WeddingCardsCollection products={products} errorMessage={errorMessage} />
    </>
  );
}
