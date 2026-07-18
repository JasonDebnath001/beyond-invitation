import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/products";
import {
  fetchErpProductBySlug,
  fetchErpProductsByCategory,
  type ErpProduct,
} from "@/lib/erpnext";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import { BRAND } from "@/components/siteConfig";
import { ProductGrid } from "@/components/ProductGrid";
import ProductGallery from "@/components/ProductGallery";
import ProductBuyBox from "@/components/ProductBuyBox";
import {
  applyResellerPricingToProduct,
  applyResellerPricingToProducts,
} from "@/lib/reseller";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const NOT_ENTERED = "not yet entered";
const DEFAULT_SITE_URL = "https://www.beyondinvitation.co.in";

type ProductLike = Product | ErpProduct;

export const dynamicParams = true;

/**
 * Product pages must render dynamically:
 * reseller pricing reads a per-visitor cookie, which cannot work with
 * static/ISR caching. Dynamic rendering also removes the need for
 * generateStaticParams (nothing is prerendered at build time).
 */
export const dynamic = "force-dynamic";

function ensureAbsoluteUrl(value?: string | null) {
  const clean = (value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  return `https://${clean}`;
}

function getSiteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL;

  return ensureAbsoluteUrl(fromEnv) || DEFAULT_SITE_URL;
}

function getErpPublicUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_ERPNEXT_URL ||
    process.env.ERPNEXT_URL ||
    "";

  return ensureAbsoluteUrl(fromEnv);
}

function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return undefined;

  const value = pathOrUrl.trim();

  if (!value) return undefined;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/files/") || value.startsWith("/private/files/")) {
    const erpUrl = getErpPublicUrl();
    return erpUrl ? `${erpUrl}${value}` : `${getSiteUrl()}${value}`;
  }

  if (value.startsWith("/")) {
    return `${getSiteUrl()}${value}`;
  }

  return `${getSiteUrl()}/products/${value}`;
}

function stripHtml(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 160) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= max) return clean;

  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function titleCase(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSubject(product: ProductLike) {
  return "subject" in product && product.subject ? product.subject.trim() : "";
}

function getSku(product: ProductLike) {
  return "itemCode" in product && product.itemCode
    ? product.itemCode
    : product.slug;
}

function buildProductUrl(product: ProductLike) {
  return `${getSiteUrl()}/products/${product.slug}`;
}

function buildCollectionUrl(product: ProductLike) {
  return `${getSiteUrl()}/collections/${product.category}`;
}

function getProductImages(product: ProductLike) {
  return (product.images || [])
    .map((image) => absoluteUrl(image))
    .filter((image): image is string => Boolean(image));
}

function buildSeoTitle(product: ProductLike) {
  const categoryLabel = titleCase(product.category);
  const subject = getSubject(product);

  const parts = [
    product.name,
    subject,
    `${categoryLabel} Invitation Card`,
    "Buy Online India",
  ].filter(Boolean);

  return truncate(`${parts.join(" | ")} - ${BRAND}`, 68);
}

function buildSeoDescription(product: ProductLike) {
  const categoryLabel = titleCase(product.category);
  const subject = getSubject(product);
  const cleanDescription = stripHtml(product.description);

  const fallback = `Buy ${product.name} online from ${BRAND}. Premium ${categoryLabel.toLowerCase()} invitation card${subject ? ` for ${subject} ceremonies` : ""
    } with customisation, quality material, and pan-India delivery.`;

  const priceLine =
    product.price > 0
      ? ` Price starts at ₹${product.price.toLocaleString("en-IN")}.`
      : "";

  return truncate(
    cleanDescription
      ? `${cleanDescription}${priceLine} Shop ${categoryLabel.toLowerCase()} invitation cards at ${BRAND}.`
      : fallback,
    160,
  );
}

function buildKeywords(product: ProductLike) {
  const categoryLabel = titleCase(product.category);
  const subject = getSubject(product);

  return [
    product.name,
    `${product.name} price`,
    `${product.name} online`,
    `${categoryLabel} invitation card`,
    `${categoryLabel} invitation card price`,
    `${categoryLabel} card online India`,
    subject ? `${subject} invitation card` : "",
    "Indian wedding invitation cards",
    "wedding cards Kolkata",
    "premium wedding cards",
    "custom invitation cards",
    "Beyond Invitation",
  ].filter(Boolean);
}

function productDetailValue(value: string | undefined | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : NOT_ENTERED;
}

async function resolveProduct(slug: string): Promise<ProductLike | null> {
  try {
    const erp = await fetchErpProductBySlug(slug);
    if (erp) return erp;
  } catch (error) {
    console.error("resolveProduct ERP fetch failed for slug:", slug, error);
  }

  const local = await getProductBySlug(slug);
  if (local) {
    return applyResellerPricingToProduct(local);
  }

  return null;
}

async function resolveRelated(product: ProductLike): Promise<Product[]> {
  if ("itemCode" in product) {
    try {
      const all = await fetchErpProductsByCategory(product.category);
      return all.filter((p) => p.slug !== product.slug).slice(0, 4);
    } catch {
      return [];
    }
  }

  const localRelated = await getRelatedProducts(product);
  return applyResellerPricingToProducts(localRelated);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await resolveProduct(slug);

    if (!product) {
      return {
        title: `Product Not Found - ${BRAND}`,
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const siteUrl = getSiteUrl();
    const productUrl = buildProductUrl(product);
    const images = getProductImages(product);
    const title = buildSeoTitle(product);
    const description = buildSeoDescription(product);
    const categoryLabel = titleCase(product.category);

    return {
      metadataBase: new URL(siteUrl),
      title,
      description,
      keywords: buildKeywords(product),
      alternates: {
        canonical: productUrl,
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
      openGraph: {
        type: "website",
        siteName: BRAND,
        locale: "en_IN",
        url: productUrl,
        title,
        description,
        images: images.map((image) => ({
          url: image,
          width: 1200,
          height: 1200,
          alt: `${product.name} - ${categoryLabel} invitation card by ${BRAND}`,
        })),
      },
      twitter: {
        card: images.length > 0 ? "summary_large_image" : "summary",
        title,
        description,
        images: images.slice(0, 1),
      },
      other: {
        "product:brand": BRAND,
        "product:retailer_item_id": getSku(product),
        "product:price:amount": String(product.price),
        "product:price:currency": "INR",
        "og:price:amount": String(product.price),
        "og:price:currency": "INR",
      },
    };
  } catch {
    return {
      title: BRAND,
      description: "Premium invitation cards by Beyond Invitation.",
      robots: {
        index: false,
        follow: true,
      },
    };
  }
}

const hasHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

function buildProductJsonLd(product: ProductLike) {
  const productUrl = buildProductUrl(product);
  const categoryLabel = titleCase(product.category);
  const subject = getSubject(product);
  const images = getProductImages(product);
  const description = buildSeoDescription(product);
  const discount = discountPercent(product);

  const additionalProperty = [
    subject
      ? {
        "@type": "PropertyValue",
        name: "Tradition",
        value: subject,
      }
      : null,
    product.customisation
      ? {
        "@type": "PropertyValue",
        name: "Customisation",
        value: stripHtml(product.customisation),
      }
      : null,
    product.material
      ? {
        "@type": "PropertyValue",
        name: "Material",
        value: stripHtml(product.material),
      }
      : null,
    product.includes
      ? {
        "@type": "PropertyValue",
        name: "Includes",
        value: stripHtml(product.includes),
      }
      : null,
    discount > 0
      ? {
        "@type": "PropertyValue",
        name: "Discount",
        value: `${discount}% OFF`,
      }
      : null,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description,
    image: images,
    sku: getSku(product),
    // mpn property removed
    brand: {
      "@type": "Brand",
      name: BRAND,
    },
    category: categoryLabel,
    material: product.material ? stripHtml(product.material) : undefined,
    additionalProperty,
    offers: {
      "@type": "Offer",
      "@id": `${productUrl}#offer`,
      url: productUrl,
      priceCurrency: "INR",
      price: product.price,
      availability:
        product.price > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/PreOrder",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: BRAND,
      },
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
    },
  };
}

function buildBreadcrumbJsonLd(product: ProductLike) {
  const productUrl = buildProductUrl(product);
  const categoryLabel = titleCase(product.category);

  return {
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
        name: categoryLabel,
        item: buildCollectionUrl(product),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };
}

function buildWebPageJsonLd(product: ProductLike) {
  const productUrl = buildProductUrl(product);

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${productUrl}#webpage`,
    url: productUrl,
    name: buildSeoTitle(product),
    description: buildSeoDescription(product),
    isPartOf: {
      "@type": "WebSite",
      name: BRAND,
      url: getSiteUrl(),
    },
    mainEntity: {
      "@id": `${productUrl}#product`,
    },
  };
}

function buildFaqJsonLd(product: ProductLike) {
  const categoryLabel = titleCase(product.category).toLowerCase();

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Is printing included with this ${categoryLabel} invitation card?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Printing charges are not included in the listed product price. Printing cost depends on impressions, printing type, foil work, and card requirements.",
        },
      },
      {
        "@type": "Question",
        name: "How long does delivery take?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Surface delivery usually takes 4 to 12 days depending on the region. Air delivery is available for urgent orders and usually takes 4 to 8 days depending on the location.",
        },
      },
      {
        "@type": "Question",
        name: "Is Cash on Delivery available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Cash on Delivery orders require a 10% advance payment at the time of booking. The remaining balance is paid at delivery.",
        },
      },
      {
        "@type": "Question",
        name: "Can this product be customised?",
        acceptedAnswer: {
          "@type": "Answer",
          text: product.customisation
            ? stripHtml(product.customisation)
            : "Customisation details depend on the selected card. Contact Beyond Invitation for exact customisation options.",
        },
      },
      {
        "@type": "Question",
        name: "What is the return policy?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Returns are not accepted unless there is an error from Beyond Invitation.",
        },
      },
    ],
  };
}

function buildRelatedJsonLd(related: Product[]) {
  if (related.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Related invitation cards",
    itemListElement: related.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: buildProductUrl(item),
      name: item.name,
    })),
  };
}

function JsonLdScript({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  if (!data) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

function SpecRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-gold/10 pb-2 last:border-b-0">
      <span className="w-32 shrink-0 text-ink-light">{label}</span>
      <span className="text-ink">{value}</span>
    </li>
  );
}

function Accordion({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-gold/15 bg-white shadow-sm transition hover:border-gold/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-[17px] font-semibold text-carbon marker:hidden sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/25 text-gold transition-transform duration-200 group-open:rotate-45">
          ＋
        </span>
      </summary>

      <div className="border-t border-gold/10 px-5 py-5 sm:px-6">
        {children}
      </div>
    </details>
  );
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const product = await resolveProduct(slug);

  if (!product) notFound();

  const related = await resolveRelated(product);
  const discount = discountPercent(product);
  const categoryLabel = product.category.replace(/-/g, " ");
  const subject = getSubject(product);

  const productJsonLd = buildProductJsonLd(product);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(product);
  const webPageJsonLd = buildWebPageJsonLd(product);
  const faqJsonLd = buildFaqJsonLd(product);
  const relatedJsonLd = buildRelatedJsonLd(related);

  return (
    <>
      <JsonLdScript data={productJsonLd} />
      <JsonLdScript data={breadcrumbJsonLd} />
      <JsonLdScript data={webPageJsonLd} />
      <JsonLdScript data={faqJsonLd} />
      <JsonLdScript data={relatedJsonLd} />

      <div className="bg-white">
        <div className="mx-auto max-w-7xl overflow-hidden px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:py-12">
          {/* Breadcrumb */}
          <nav className="mb-5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[11.5px] text-ink-light sm:mb-8 sm:text-[12.5px]">
            <Link
              href="/"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-carbon"
            >
              Home
            </Link>

            <span className="shrink-0 text-gold">/</span>

            <Link
              href={`/collections/${product.category}`}
              className="shrink-0 whitespace-nowrap capitalize transition-colors hover:text-carbon"
            >
              {categoryLabel}
            </Link>

            <span className="shrink-0 text-gold">/</span>

            <span className="min-w-0 truncate text-ink">{product.name}</span>
          </nav>

          {/* Product layout */}
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] xl:items-start xl:gap-10 2xl:gap-14">
            {/* Left: Gallery */}
            <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
              <ProductGallery
                images={product.images || []}
                videos={product.videos}
                emoji={product.emoji}
                alt={product.name}
                badge={product.badge}
              />
            </div>

            {/* Right: Product information */}
            <div className="min-w-0 flex flex-col">
              {/* Product name + price */}
              <section className="min-w-0 rounded-2xl border border-gold/15 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold">
                  <span className="capitalize">{categoryLabel}</span>

                  {subject && (
                    <>
                      <span className="text-gold/40">✦</span>
                      <span>{subject}</span>
                    </>
                  )}
                </div>

                <h1 className="mt-3 break-words font-display text-2xl font-semibold leading-[1.12] text-carbon sm:text-3xl lg:text-[36px] 2xl:text-[40px]">
                  {product.name}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-ink-mid">
                  <span className="tracking-[0.15em] text-gold">★★★★★</span>
                  <span className="h-3 w-px bg-gold/30" />
                  <span>Handcrafted to order</span>
                </div>

                <div className="mt-6 flex flex-wrap items-end gap-3">
                  <span className="font-display text-[30px] font-bold leading-none text-carbon sm:text-[34px]">
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>

                  {product.mrp > product.price && (
                    <span className="pb-0.5 text-lg text-ink-light line-through">
                      ₹{product.mrp.toLocaleString("en-IN")}
                    </span>
                  )}

                  {discount > 0 && (
                    <span className="mb-0.5 rounded-md bg-[#E8F7EE] px-2.5 py-1 text-[13px] font-semibold text-[#27A060]">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[12px] text-ink-light">
                  Inclusive of all taxes
                </p>

                <div className="my-7 h-px w-full bg-gradient-to-r from-gold/30 via-gold/15 to-transparent" />

                <ProductBuyBox product={product} />
              </section>

              {/* Description */}
              <section className="mt-5 min-w-0 rounded-2xl border border-gold/15 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="font-display text-[17px] font-semibold text-carbon">
                  Description
                </h2>

                <div className="mt-4 text-[14px] leading-relaxed text-ink-mid">
                  {product.description ? (
                    hasHtml(product.description) ? (
                      <div
                        className="max-w-full space-y-3 overflow-hidden break-words [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                        dangerouslySetInnerHTML={{
                          __html: product.description,
                        }}
                      />
                    ) : (
                      <p className="whitespace-pre-line break-words">
                        {product.description}
                      </p>
                    )
                  ) : (
                    <p>{NOT_ENTERED}</p>
                  )}
                </div>
              </section>

              {/* Collapsible sections */}
              <div className="mt-5 min-w-0 space-y-3">
                <Accordion title="Printing">
                  <p className="text-[14px] leading-relaxed text-ink-mid">
                    Printing charges is not included in the above price. The
                    printing cost is dependent on variables like number of
                    impressions, type of printing - Screen / UV / Offset, gold
                    foil impression optional &amp; nature of cards. Please
                    contact our customer care to know the printing cost of the
                    card selected by you.
                  </p>
                </Accordion>

                <Accordion title="Shipping">
                  <div className="space-y-5 text-[14px] leading-relaxed text-ink-mid">
                    <div>
                      <h3 className="font-semibold text-carbon">1. Surface</h3>

                      <p className="mt-2">
                        Sent by courier through surface mode with door delivery.
                        Delivery timelines vary by location.
                      </p>

                      <ul className="mt-3 space-y-1">
                        <li>
                          <span className="font-medium text-carbon">
                            South India:
                          </span>{" "}
                          4 to 7 days
                        </li>

                        <li>
                          <span className="font-medium text-carbon">
                            North East and Himalayan region:
                          </span>{" "}
                          8 to 12 days
                        </li>

                        <li>
                          <span className="font-medium text-carbon">
                            Rest of India:
                          </span>{" "}
                          7 to 10 days
                        </li>
                      </ul>
                    </div>

                    <p>
                      Shipping cost is based on weight. Just add products to
                      your cart and use the Shipping calculator to see the
                      shipping price and expected Time of Delivery.
                    </p>
                  </div>
                </Accordion>

                <Accordion title="Cash on Delivery">
                  <div className="space-y-3 text-[14px] leading-relaxed text-ink-mid">
                    <p>
                      For Cash on Delivery orders, a 10% advance payment is
                      required at the time of booking. The remaining balance must
                      be paid at the time of delivery. For assistance, please
                      contact our team.
                    </p>

                    <p>
                      <span className="font-medium text-carbon">Phone - </span>

                      <a
                        href="tel:+917044815488"
                        className="font-semibold text-carbon underline decoration-gold/40 underline-offset-4 transition hover:text-gold"
                      >
                        +91 7044815488
                      </a>
                    </p>
                  </div>
                </Accordion>

                <Accordion title="Dimensions">
                  <ul className="space-y-2 text-[14px] text-ink-mid">
                    <SpecRow label="Height" value="9.5 cm" />
                    <SpecRow label="Width" value="18 cm" />
                    <SpecRow label="Weight" value="326 g" />
                  </ul>
                </Accordion>

                <Accordion title="Return Policy">
                  <p className="text-[14px] leading-relaxed text-ink-mid">
                    We hope you love your order! However, we do not accept
                    returns unless there is an error from our end.
                  </p>
                </Accordion>

                <Accordion title="Product Details">
                  <ul className="space-y-2 text-[14px] text-ink-mid">
                    <SpecRow
                      label="Category"
                      value={<span className="capitalize">{categoryLabel}</span>}
                    />

                    {subject && <SpecRow label="Tradition" value={subject} />}

                    <SpecRow
                      label="Customisation"
                      value={productDetailValue(product.customisation)}
                    />

                    <SpecRow
                      label="Material"
                      value={productDetailValue(product.material)}
                    />
                  </ul>

                  <p className="mt-4 text-[14px] leading-relaxed text-ink-mid">
                    <span className="font-medium text-carbon">Phone - </span>

                    <a
                      href="tel:+917044815488"
                      className="font-semibold text-carbon underline decoration-gold/40 underline-offset-4 transition hover:text-gold"
                    >
                      +91 7044815488
                    </a>
                  </p>
                </Accordion>
              </div>
            </div>
          </div>

          {/* Related products */}
          {related.length > 0 && (
            <section className="mt-14 sm:mt-20">
              <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
                    More to love
                  </p>

                  <h2 className="mt-2 font-display text-[26px] font-semibold text-carbon sm:text-[28px] md:text-[34px]">
                    You May Also Like
                  </h2>

                  <div className="mt-4 h-px w-14 bg-carbon" />
                </div>

                <Link
                  href={`/collections/${product.category}`}
                  className="inline-flex shrink-0 items-center gap-2 border-b border-carbon pb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon"
                >
                  View collection <span>→</span>
                </Link>
              </div>

              <ProductGrid products={related} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}