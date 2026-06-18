import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import FilterableProductGrid from "@/components/FilterableProductGrid";
import { fetchErpProducts } from "@/lib/erpnext";
import type { Product } from "@/types";
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
  "Explore premium wedding cards in Kolkata from Beyond Invitation. Shop Hindu, Muslim, Christian and designer Indian wedding invitation cards with custom printing and pan-India delivery.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title,
  description,
  keywords: PRIMARY_KEYWORDS,
  alternates: {
    canonical: "/wedding-cards",
  },
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

function isWeddingProduct(product: Product) {
  const text = [
    product.name,
    product.slug,
    product.description,
    product.category,
    product.badge,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("wedding") ||
    text.includes("marriage") ||
    text.includes("bride") ||
    text.includes("groom") ||
    text.includes("invitation")
  );
}

function getProductImage(product: Product) {
  const image = product.images?.[0];

  if (!image) return siteUrl(DEFAULT_OG_IMAGE);

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return siteUrl(image);
}

async function getWeddingProducts(): Promise<Product[]> {
  try {
    const products = (await fetchErpProducts()) as Product[];

    return products.filter(isWeddingProduct).slice(0, 80);
  } catch (error) {
    console.error("Wedding cards page ERPNext fetch failed:", error);
    return [];
  }
}

export default async function WeddingCardsPage() {
  const products = await getWeddingProducts();

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getSiteUrl()}/#localbusiness`,
    name: SITE_NAME,
    url: getSiteUrl(),
    image: siteUrl(DEFAULT_OG_IMAGE),
    description: SITE_DESCRIPTION,
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      ...BUSINESS_ADDRESS,
    },
    areaServed: [
      {
        "@type": "City",
        name: "Kolkata",
      },
      {
        "@type": "State",
        name: "West Bengal",
      },
      {
        "@type": "Country",
        name: "India",
      },
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
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: "Custom Wedding Invitation Cards",
          category: "Invitation Printing",
        },
      },
    ],
  };

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
        image: getProductImage(product),
        url: siteUrl(`/products/${product.slug}`),
        offers: {
          "@type": "Offer",
          priceCurrency: "INR",
          price: product.price,
          availability: "https://schema.org/InStock",
        },
      },
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Where can I buy wedding cards in Kolkata?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can buy premium wedding cards from Beyond Invitation in Kolkata. The collection includes Indian wedding invitation cards, designer cards, shagun envelopes, boxes and custom invitation stationery.",
        },
      },
      {
        "@type": "Question",
        name: "Does Beyond Invitation offer custom wedding invitation cards?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Beyond Invitation offers custom wedding invitation cards with design, material, printing and finishing options depending on the selected card.",
        },
      },
      {
        "@type": "Question",
        name: "Are wedding cards available for delivery outside Kolkata?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Beyond Invitation serves customers across India, with delivery timelines depending on location and order type.",
        },
      },
      {
        "@type": "Question",
        name: "What types of wedding cards are available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The collection includes Hindu wedding cards, Muslim wedding cards, Christian wedding cards, premium invitation cards, luxury invitation boxes and traditional Indian wedding invitation cards.",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {products.length > 0 ? <JsonLd data={itemListJsonLd} /> : null}
      <JsonLd data={faqJsonLd} />

      <main className="bg-cream text-ink">
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-maroon">
            Wedding Invitation Specialists
          </p>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Wedding Cards in Kolkata for Beautiful Indian Weddings
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-mid">
            Beyond Invitation offers premium wedding cards, designer wedding
            invitation cards, custom printed invitations, shagun envelopes and
            wedding stationery for families in Kolkata and across India.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#wedding-card-collection"
              className="rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-gold-light transition hover:bg-maroon/90"
            >
              View Wedding Cards
            </Link>

            <Link
              href="/contact"
              className="rounded-full border border-maroon px-6 py-3 text-sm font-semibold text-maroon transition hover:bg-maroon hover:text-gold-light"
            >
              Ask for Custom Design
            </Link>
          </div>
        </section>

        <section className="border-y border-gold/25 bg-white/70">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                Premium Wedding Cards
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-mid">
                Explore elegant, traditional and modern wedding invitation cards
                with rich paper, printing and finishing options.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-ink">
                Kolkata Showroom
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-mid">
                Visit Beyond Invitation at China Bazar, B.B.D. Bagh, Kolkata to
                see card samples, materials and invitation finishes in person.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-ink">
                Pan-India Delivery
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-mid">
                Order wedding cards online from Kolkata and get invitation
                stationery delivered across India.
              </p>
            </div>
          </div>
        </section>

        <section
          id="wedding-card-collection"
          className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
        >
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-maroon">
              Shop the Collection
            </p>

            <h2 className="mt-3 text-3xl font-bold text-ink">
              Wedding Invitation Cards Online
            </h2>

            <p className="mt-3 text-base leading-7 text-ink-mid">
              Browse Indian wedding cards, designer cards, luxury invitations
              and custom wedding card options. Use the filters to find cards by
              price and style.
            </p>
          </div>

          {products.length > 0 ? (
            <FilterableProductGrid products={products} />
          ) : (
            <div className="rounded-2xl border border-gold/25 bg-white p-8 text-center">
              <h2 className="text-xl font-bold text-ink">
                Wedding card collection is being updated
              </h2>
              <p className="mt-2 text-sm text-ink-mid">
                Please contact Beyond Invitation for the latest wedding card
                catalogue and custom invitation options.
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-gold-light"
              >
                Contact Us
              </Link>
            </div>
          )}
        </section>

        <section className="bg-white/80">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-ink">
              Why Choose Beyond Invitation for Wedding Cards?
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gold/25 bg-cream p-6">
                <h3 className="text-lg font-semibold text-ink">
                  Wedding card specialists
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-mid">
                  Beyond Invitation focuses on wedding invitation cards and
                  celebration stationery, so every design is made around Indian
                  wedding requirements.
                </p>
              </div>

              <div className="rounded-2xl border border-gold/25 bg-cream p-6">
                <h3 className="text-lg font-semibold text-ink">
                  Customisation support
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-mid">
                  Choose card design, paper feel, printing style, inserts,
                  envelopes and matching accessories based on your wedding
                  theme.
                </p>
              </div>

              <div className="rounded-2xl border border-gold/25 bg-cream p-6">
                <h3 className="text-lg font-semibold text-ink">
                  Traditional and modern designs
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-mid">
                  Find Hindu wedding cards, Muslim wedding cards, Christian
                  wedding cards and premium invitation boxes in one place.
                </p>
              </div>

              <div className="rounded-2xl border border-gold/25 bg-cream p-6">
                <h3 className="text-lg font-semibold text-ink">
                  Trusted Kolkata store
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-mid">
                  The showroom in Kolkata helps customers compare real card
                  quality before placing their order.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-ink">Wedding Cards FAQ</h2>

          <div className="mt-8 space-y-5">
            <div>
              <h3 className="font-semibold text-ink">
                Where can I buy wedding cards in Kolkata?
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-mid">
                You can buy premium wedding cards from Beyond Invitation in
                Kolkata, including designer wedding invitation cards, shagun
                envelopes, boxes and matching stationery.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-ink">
                Can I order custom wedding invitation cards?
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-mid">
                Yes. Customisation depends on card design, material, printing
                style and finishing requirements.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-ink">
                Do you deliver wedding cards outside Kolkata?
              </h3>
              <p className="mt-1 text-sm leading-6 text-ink-mid">
                Yes. Orders can be delivered across India depending on location
                and delivery type.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}