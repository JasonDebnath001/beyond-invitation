import type { Metadata } from "next";

import JsonLd from "@/components/seo/JsonLd";
import { fetchWeddingProductPage } from "@/lib/catalog-browse";
import { facetCounts, weddingFiltersFromSearchParams, type BrowserProduct, type WeddingProductPage, type WeddingSearchParams } from "@/lib/wedding-cards";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  getSiteUrl,
  siteUrl,
} from "@/lib/site-config";
import WeddingCardsCollection from "@/components/wedding-cards/WeddingCardsCollection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ITEM_CATEGORY = "Wedding Box";
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

function getProductImage(product: BrowserProduct) {
  const image = product.image;

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

export default async function WeddingBoxesPage({ searchParams }: { searchParams: Promise<WeddingSearchParams> }) {
  const initialFilters = weddingFiltersFromSearchParams(await searchParams, "boxes");
  let initialPage: WeddingProductPage = { products: [], nextOffset: null, total: 0, facets: facetCounts([]) };
  let errorMessage = "";
  try {
    initialPage = await fetchWeddingProductPage({ collectionType: "boxes", filters: initialFilters });
  } catch (error) {
    console.error("Wedding boxes page fetch failed:", error);
    errorMessage = "Unable to load wedding boxes.";
  }

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
    itemListElement: initialPage.products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: siteUrl(`/products/${product.slug}`),
      item: {
        "@type": "Product",
        name: product.name,
        description,
        image: getProductImage(product),
        url: siteUrl(`/products/${product.slug}`),
        category: ITEM_CATEGORY,
        offers: product.price > 0 ? {
          "@type": "Offer",
          priceCurrency: "INR",
          price: product.price,
          availability: "https://schema.org/InStock",
        } : undefined,
      },
    })),
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {initialPage.products.length > 0 ? <JsonLd data={itemListJsonLd} /> : null}

      <WeddingCardsCollection
        title="Wedding Boxes"
        collectionType="boxes"
        initialPage={initialPage}
        initialFilters={initialFilters}
        errorMessage={errorMessage}
        emptyTitle="No wedding boxes just yet"
      />
    </>
  );
}
