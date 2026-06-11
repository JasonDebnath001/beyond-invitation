// app/page.tsx

import type { Metadata } from "next";
import { getAllCategories } from "@/lib/products";
import { fetchErpProducts, type ErpProduct } from "@/lib/erpnext";

import {
  CelebrationGrid,
  SaleCollection,
  FeatureStrip,
  WhyUs,
  OurShowroom,
  Catalogue,
} from "@/components/Sections";

import HeroCarousel from "@/components/HeroCarousel";
import { ProductSection } from "@/components/ProductGrid";
import KindWords from "@/components/KindWords";
import InstagramReels from "@/components/InstagramReels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const siteUrl = "https://www.beyondinvitation.co.in";

const siteName = "Beyond Invitation";

const title =
  "Beyond Invitation | Wedding Cards, Shagun Envelopes & Invitation Printing in Kolkata";

const description =
  "Shop premium wedding cards, shagun envelopes, shagun boxes, rakhi packaging, and custom invitation stationery from Beyond Invitation in Kolkata.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "Beyond Invitation",
    "wedding cards Kolkata",
    "wedding invitation cards Kolkata",
    "invitation printing Kolkata",
    "custom wedding invitations",
    "premium wedding cards",
    "Hindu wedding cards",
    "Muslim wedding cards",
    "Christian wedding cards",
    "shagun envelopes",
    "shagun boxes",
    "rakhi packaging",
    "rakhi cards",
    "rakhi boxes",
    "Indian wedding invitations",
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
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Beyond Invitation wedding cards and invitation stationery",
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

function getNormalProducts(products: ErpProduct[]): ErpProduct[] {
  return products.map((product) => {
    const originalPrice = Number(product.price || 0);

    return {
      ...product,
      // Normal product sections should NOT show the sale strikethrough.
      mrp: originalPrice,
      // Remove sale-only display from normal sections.
      badge: product.badge === "SALE" ? undefined : product.badge,
      onSale: false,
    };
  });
}

function getAbsoluteImageUrl(image?: string) {
  if (!image) return undefined;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  if (image.startsWith("/")) {
    return `${siteUrl}${image}`;
  }

  return `${siteUrl}/${image}`;
}

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default async function HomePage() {
  const categories = await getAllCategories();

  let erpProducts: ErpProduct[] = [];
  let erpError = "";

  try {
    erpProducts = await fetchErpProducts();
  } catch (error) {
    console.error("ERPNext product fetch failed on homepage:", error);

    erpError =
      error instanceof Error
        ? error.message
        : "Unknown ERPNext product fetch error";
  }

  const normalProducts = getNormalProducts(erpProducts);
  const featuredProducts = normalProducts.slice(0, 8);

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

  const productListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Featured wedding cards and invitation stationery",
    itemListElement: featuredProducts.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/products/${product.slug}`,
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description || description,
        image: getAbsoluteImageUrl(product.images?.[0]),
        url: `${siteUrl}/products/${product.slug}`,
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: product.price,
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };

  return (
    <>
      <JsonLdScript data={localBusinessJsonLd} />
      <JsonLdScript data={websiteJsonLd} />
      {!erpError && featuredProducts.length > 0 ? (
        <JsonLdScript data={productListJsonLd} />
      ) : null}

      <HeroCarousel />

      <CelebrationGrid categories={categories} />

      {erpError ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="text-sm font-semibold uppercase tracking-[0.3em]">
              ERPNext Error
            </p>

            <h2 className="mt-3 font-serif text-3xl">
              ERP products could not be loaded
            </h2>

            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs">
              {erpError}
            </pre>
          </div>
        </section>
      ) : (
        <>
          <SaleCollection products={erpProducts} />

          <ProductSection
            label="Fresh from our catalogue"
            title="Trendy Collection"
            products={normalProducts}
            viewAllHref="/collections/wedding"
            viewAllText="View All Products"
          />

          <FeatureStrip />

          <ProductSection
            label="Exclusive & elegant"
            title="Premium Invitations"
            products={normalProducts}
            viewAllHref="/collections/luxe"
            viewAllText="View All Premium Cards"
            shaded
          />
        </>
      )}

      <WhyUs />

      <OurShowroom />

      <Catalogue />

      <KindWords />

      <InstagramReels />
    </>
  );
}