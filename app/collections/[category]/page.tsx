import { notFound } from "next/navigation";
import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import { getAllCategories, getCategoryBySlug } from "@/lib/products";
import { fetchErpProducts, type ErpProduct } from "@/lib/erpnext";
import type { ProductCategory } from "@/types";
import FilterableProductGrid from "@/components/FilterableProductGrid";
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

  const seo = getCategorySeo(category.slug, category.name, category.description);
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

  let allProducts: ErpProduct[] = [];
  let products: ErpProduct[] = [];
  let errorMessage = "";

  try {
    allProducts = await fetchErpProducts();
    products = allProducts.filter(
      (product) => product.category === (categorySlug as ProductCategory),
    );
  } catch (error) {
    console.error(`ERPNext ${category.name} fetch failed:`, error);
    errorMessage =
      error instanceof Error
        ? error.message
        : "Unable to fetch products from ERPNext.";
  }

  const collectionUrl = siteUrl(`/collections/${category.slug}`);
  const seo = getCategorySeo(category.slug, category.name, category.description);
  const weddingCategory = isWeddingCategory(category.slug);

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
        name: product.name,
      })),
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {products.length > 0 ? <JsonLd data={collectionJsonLd} /> : null}

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-maroon">
          Collection
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          {weddingCategory
            ? `${category.name} Wedding Invitation Cards`
            : category.name}
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-ink-mid">
          {weddingCategory
            ? "Browse premium wedding cards in Kolkata, including designer Indian wedding invitation cards, custom printed invitations and luxury wedding card options from Beyond Invitation."
            : category.description}
        </p>

        {!errorMessage && (
          <p className="mt-6 text-sm font-medium text-ink-mid">
            {products.length} {products.length === 1 ? "Product" : "Products"}
          </p>
        )}

        {errorMessage ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">
              ERPNext Error
            </p>
            <h2 className="mt-2 text-xl font-bold">
              Products could not be loaded
            </h2>
            <p className="mt-2 text-sm">{errorMessage}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-gold/25 bg-white p-8 text-center">
            <h2 className="text-xl font-bold text-ink">No products found</h2>
            <p className="mt-2 text-sm text-ink-mid">
              ERPNext connected successfully, but no visible products were found
              for this collection.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <FilterableProductGrid products={products} />
          </div>
        )}
      </main>
    </>
  );
}