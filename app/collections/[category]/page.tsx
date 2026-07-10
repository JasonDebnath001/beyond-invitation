import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CategoryCollectionPageClient from "@/components/CategoryCollectionPage";
import JsonLd from "@/components/seo/JsonLd";
import { fetchErpProducts, type ErpProduct } from "@/lib/erpnext";
import { getAllCategories, getCategoryBySlug } from "@/lib/products";
import {
  DEFAULT_OG_IMAGE,
  PRIMARY_KEYWORDS,
  SITE_NAME,
  getSiteUrl,
  siteUrl,
} from "@/lib/site-config";

interface PageProps {
  params: Promise<{ category: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await getAllCategories();

  return categories.map((category) => ({
    category: category.slug,
  }));
}

function titleCase(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isWeddingCategory(categorySlug: string) {
  return categorySlug.toLowerCase().includes("wedding");
}

function getCategorySeo(
  categorySlug: string,
  categoryName: string,
  description: string,
) {
  if (isWeddingCategory(categorySlug)) {
    return {
      title: `${categoryName} | Wedding Invitation Cards in Kolkata`,
      description:
        "Browse premium wedding cards from Beyond Invitation. Explore Indian wedding invitation cards, designer wedding cards, custom invitation printing and luxury wedding card options in Kolkata.",
      keywords: PRIMARY_KEYWORDS,
    };
  }

  const label = titleCase(categoryName);

  return {
    title: `${label} Invitation Cards | Beyond Invitation`,
    description:
      description ||
      `Explore ${label.toLowerCase()} invitation cards and premium celebration stationery from Beyond Invitation in Kolkata.`,
    keywords: [
      `${label} invitation cards`,
      `${label} cards Kolkata`,
      `${label} cards online India`,
      "invitation cards Kolkata",
      "custom invitation cards",
      "Beyond Invitation",
    ],
  };
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    return {
      title: "Collection Not Found | Beyond Invitation",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const seo = getCategorySeo(
    category.slug,
    category.name,
    category.description,
  );

  const canonicalPath = `/collections/${category.slug}`;

  return {
    metadataBase: new URL(getSiteUrl()),
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: siteUrl(canonicalPath),
      siteName: SITE_NAME,
      type: "website",
      locale: "en_IN",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${category.name} invitation cards by Beyond Invitation`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
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
}

export default async function CollectionPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    const allProducts = await fetchErpProducts();

    products = allProducts.filter(
      (product) => product.category === category.slug,
    );
  } catch (error) {
    console.error(`${category.name} collection fetch failed:`, error);
    errorMessage = "Unable to load this collection.";
  }

  const collectionUrl = siteUrl(`/collections/${category.slug}`);

  const seo = getCategorySeo(
    category.slug,
    category.name,
    category.description,
  );

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
        name: category.name,
        item: collectionUrl,
      },
    ],
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${collectionUrl}#collection`,
    url: collectionUrl,
    name: seo.title,
    description: seo.description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    mainEntity: {
      "@type": "ItemList",
      name: `${category.name} products`,
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: siteUrl(`/products/${product.slug}`),
        item: {
          "@type": "Product",
          name: product.name,
          description: product.description || seo.description,
          image: getProductImage(product),
          url: siteUrl(`/products/${product.slug}`),
          category: category.name,
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: product.price,
            availability: "https://schema.org/InStock",
          },
        },
      })),
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {products.length > 0 ? <JsonLd data={collectionJsonLd} /> : null}

      <CategoryCollectionPageClient
        categoryName={category.name}
        categoryDescription={category.description}
        products={products}
        errorMessage={errorMessage}
      />
    </>
  );
}