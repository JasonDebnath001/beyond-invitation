import type { Metadata } from "next";

import JsonLd from "@/components/seo/JsonLd";
import { fetchErpProducts } from "@/lib/erpnext";
import type { ErpProduct } from "@/lib/erpnext";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  getSiteUrl,
  siteUrl,
} from "@/lib/site-config";
import WeddingBoxesPageClient from "@/components/WeddingBoxesPageClient";

export const dynamic = "force-dynamic";

const PAGE_PATH = "/wedding-boxes";
const PAGE_URL = siteUrl(PAGE_PATH);

const title = "Wedding Boxes | Premium Invitation Boxes";
const description =
  "Explore premium wedding boxes by Beyond Invitation — elegant invitation boxes crafted for luxury wedding gifting and presentation.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title,
  description,
  keywords: [
    "wedding boxes",
    "premium wedding boxes",
    "luxury wedding invitation boxes",
    "wedding invitation box",
    "wedding card boxes",
    "Beyond Invitation",
  ],
  alternates: {
    canonical: PAGE_PATH,
  },
  openGraph: {
    title,
    description,
    url: PAGE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Premium wedding boxes by Beyond Invitation",
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

/*
 * Lenient Subject matching.
 *
 * ERPNext Subject values are not always identical strings:
 * "Wedding Box", "Wedding Boxes", "wedding box " must all match.
 *
 * Normalization: trim, collapse repeated spaces, lowercase.
 * A product matches when its normalized subject STARTS WITH "wedding box",
 * which covers both singular and plural.
 */
const WEDDING_BOX_SUBJECT_PREFIX = "wedding box";

function normalizeSubject(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isWeddingBoxProduct(product: ErpProduct) {
  return normalizeSubject(product.subject).startsWith(
    WEDDING_BOX_SUBJECT_PREFIX,
  );
}

function getProductImage(product: ErpProduct) {
  const image = product.images?.[0];

  if (!image) {
    return siteUrl(DEFAULT_OG_IMAGE);
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  if (image.startsWith("/")) {
    return siteUrl(image);
  }

  return siteUrl(`/products/${image}`);
}

async function getWeddingBoxProducts(): Promise<{
  products: ErpProduct[];
  errorMessage: string;
}> {
  try {
    const products = await fetchErpProducts();

    return {
      products: products.filter(isWeddingBoxProduct),
      errorMessage: "",
    };
  } catch (error) {
    console.error("Wedding boxes page fetch failed:", error);

    return {
      products: [],
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unable to load wedding boxes.",
    };
  }
}

export default async function WeddingBoxesPage() {
  const { products, errorMessage } = await getWeddingBoxProducts();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: getSiteUrl(),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Wedding Boxes",
        item: PAGE_URL,
      },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Wedding boxes by Beyond Invitation",
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: siteUrl(`/products/${product.slug}`),
      item: {
        "@type": "Product",
        name: product.name,
        description: product.description || description,
        image: getProductImage(product),
        url: siteUrl(`/products/${product.slug}`),
        category: "Wedding Box",
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
      <JsonLd data={breadcrumbJsonLd} />
      {products.length > 0 ? <JsonLd data={itemListJsonLd} /> : null}

      <WeddingBoxesPageClient products={products} errorMessage={errorMessage} />
    </>
  );
}
