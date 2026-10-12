// app/page.tsx

import type { Metadata } from "next";
import { Suspense } from "react";

import { getAllCategories } from "@/lib/products";

import JsonLd from "@/components/seo/JsonLd";
import { getSiteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo";

import {
  CelebrationGrid,
  WhyUs,
  OurShowroom,
  Catalogue,
} from "@/components/Sections";

import HeroCarousel from "@/components/HeroCarousel";
import HomeProducts, { HomeProductsSkeleton } from "@/components/home/HomeProducts";
import KindWords from "@/components/KindWords";
import InstagramReels from "@/components/InstagramReels";
import HomeTextAnimation from "@/components/HomeTextAnimation";
import WeddingBoxesEditorial from "@/components/WeddingBoxesEditorial";
import CustomerReviewVideo from "@/components/CustomerReviwVideo";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const siteUrl = getSiteUrl();

const siteName = SITE_NAME;

const title =
  "Wedding Cards in Kolkata | Wedding Invitation Cards Online India - Beyond Invitation";

const description =
  "Shop premium wedding cards in Kolkata from Beyond Invitation. Explore Indian wedding invitation cards, designer wedding cards, shagun envelopes and wedding stationery with pan-India delivery.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "wedding cards",
    "wedding card",
    "wedding cards Kolkata",
    "wedding invitation cards",
    "wedding invitation cards Kolkata",
    "wedding cards online India",
    "Indian wedding cards",
    "designer wedding cards",
    "premium wedding cards",
    "invitation printing Kolkata",
    "Hindu wedding cards",
    "Muslim wedding cards",
    "Christian wedding cards",
    "shagun envelopes",
    "shagun boxes",
    "rakhi packaging",
    "Beyond Invitation",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName,
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE) || "/logo.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} wedding cards and invitation stationery`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/logo.png"],
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

export default async function HomePage() {
  const categories = await getAllCategories();

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#localbusiness`,
    name: siteName,
    url: siteUrl,
    image: `${siteUrl}/logo.png`,
    description,
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress:
        "Shop No. 8, Indra Kumar Karnani St, China Bazar, B.B.D. Bagh",
      addressLocality: "Kolkata",
      addressRegion: "West Bengal",
      postalCode: "700001",
      addressCountry: "IN",
    },
    areaServed: [
      {
        "@type": "City",
        name: "Kolkata",
      },
      {
        "@type": "Country",
        name: "India",
      },
    ],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteName,
    url: siteUrl,
    publisher: {
      "@id": `${siteUrl}/#localbusiness`,
    },
  };

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={websiteJsonLd} />

      <div data-home-text-motion className="overflow-hidden">
        <HeroCarousel />

        <WeddingBoxesEditorial />

        <HomeTextAnimation />

        <CelebrationGrid categories={categories} />

        {/* Stream the catalogue independently of the hero and editorial content.
            Keep streamed headings out of the one-time page animation scan. */}
        <div data-no-text-motion>
          <Suspense fallback={<HomeProductsSkeleton />}>
            <HomeProducts description={description} />
          </Suspense>
        </div>

        <WhyUs />

        <OurShowroom />

        <Catalogue />

        <KindWords />

        <CustomerReviewVideo />

        <InstagramReels />
      </div>
    </>
  );
}
