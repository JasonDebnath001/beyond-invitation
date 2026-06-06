import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  getProductBySlug,
  getAllProductSlugs,
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

interface PageProps {
  params: Promise<{ slug: string }>;
}

const NOT_ENTERED = "not yet entered";

/** Resolve a product from local JSON first, then ERPNext if configured. */
async function resolveProduct(
  slug: string,
): Promise<Product | ErpProduct | null> {
  const local = await getProductBySlug(slug);

  if (local) return local;

  try {
    const erp = await fetchErpProductBySlug(slug);

    if (erp) return erp;
  } catch {
    // ERPNext not configured / unreachable — fall through to 404.
  }

  return null;
}

/** Related products, pulled from the same source as the product. */
async function resolveRelated(
  product: Product | ErpProduct,
): Promise<Product[]> {
  if ("itemCode" in product) {
    try {
      const all = await fetchErpProductsByCategory(product.category);

      return all.filter((p) => p.slug !== product.slug).slice(0, 4);
    } catch {
      return [];
    }
  }

  return getRelatedProducts(product);
}

/** Pre-render local products at build time; ERP products render on demand. */
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();

  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const product = await resolveProduct(slug);

  if (!product) return { title: `Product Not Found – ${BRAND}` };

  return {
    title: `${product.name} – ${BRAND}`,
    description:
      product.description?.replace(/<[^>]+>/g, "").slice(0, 160) || undefined,
  };
}

const hasHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

function productDetailValue(value: string | undefined | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : NOT_ENTERED;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const product = await resolveProduct(slug);

  if (!product) notFound();

  const related = await resolveRelated(product);
  const discount = discountPercent(product);

  const categoryLabel = product.category.replace(/-/g, " ");

  const subject =
    "subject" in product && product.subject ? product.subject : "";

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 overflow-hidden text-[12px] text-ink-light sm:mb-8 sm:text-[12.5px]">
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

          <span className="truncate text-ink">{product.name}</span>
        </nav>

        {/* Product layout */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-14">
          {/* Left: Gallery */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery
              images={product.images}
              videos={product.videos}
              emoji={product.emoji}
              alt={product.name}
              badge={product.badge}
            />
          </div>

          {/* Right: Product information */}
          <div className="flex flex-col">
            {/* Non-collapsible name + price section */}
            <section className="rounded-2xl border border-gold/15 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold">
                <span className="capitalize">{categoryLabel}</span>

                {subject && (
                  <>
                    <span className="text-gold/40">✦</span>
                    <span>{subject}</span>
                  </>
                )}
              </div>

              <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.12] text-carbon md:text-[40px]">
                {product.name}
              </h1>

              <div className="mt-4 flex items-center gap-3 text-[13px] text-ink-mid">
                <span className="tracking-[0.15em] text-gold">★★★★★</span>
                <span className="h-3 w-px bg-gold/30" />
                <span>Handcrafted to order</span>
              </div>

              <div className="mt-6 flex flex-wrap items-end gap-3">
                <span className="font-display text-[34px] font-bold leading-none text-carbon">
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

            {/* Non-collapsible Description */}
            <section className="mt-5 rounded-2xl border border-gold/15 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-[17px] font-semibold text-carbon">
                Description
              </h2>

              <div className="mt-4 text-[14px] leading-relaxed text-ink-mid">
                {product.description ? (
                  hasHtml(product.description) ? (
                    <div
                      className="space-y-3 [&_li]:ml-4 [&_li]:list-disc"
                      dangerouslySetInnerHTML={{
                        __html: product.description,
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-line">
                      {product.description}
                    </p>
                  )
                ) : (
                  <p>{NOT_ENTERED}</p>
                )}
              </div>
            </section>

            {/* Collapsible sections */}
            <div className="mt-5 space-y-3">
              <Accordion title="Printing">
                <p className="text-[14px] leading-relaxed text-ink-mid">
                  Printing charges is not included in the above price. The
                  printing cost is dependent on variables like number of
                  impressions, type of printing - Screen / UV / Offset, gold
                  foil impression (optional) &amp; nature of cards. Please
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

                  <div>
                    <h3 className="font-semibold text-carbon">2. Air</h3>

                    <p className="mt-2">
                      Quick delivery by air, ideal for urgent orders.
                    </p>

                    <ul className="mt-3 space-y-1">
                      <li>
                        <span className="font-medium text-carbon">
                          South India:
                        </span>{" "}
                        Not applicable, Surface delivery takes same time as Air.
                      </li>

                      <li>
                        <span className="font-medium text-carbon">
                          North East and Himalayan region:
                        </span>{" "}
                        5 to 8 days
                      </li>

                      <li>
                        <span className="font-medium text-carbon">
                          Rest of India:
                        </span>{" "}
                        4 to 5 days
                      </li>
                    </ul>
                  </div>

                  <p>
                    Shipping cost is based on weight. Just add products to your
                    cart and use the Shipping calculator to see the shipping
                    price and expected Time of Delivery.
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
                  <SpecRow label="Height" value="27 cm" />
                  <SpecRow label="Width" value="20.5 cm" />
                  <SpecRow label="Weight" value="326 g" />
                </ul>
              </Accordion>

              <Accordion title="Return Policy">
                <p className="text-[14px] leading-relaxed text-ink-mid">
                  We hope you love your order! However, we do not accept returns
                  unless there is an error from our end.
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

                  <SpecRow
                    label="Includes"
                    value={productDetailValue(product.includes)}
                  />
                </ul>
              </Accordion>
            </div>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-14 sm:mt-20">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
                  More to love
                </p>

                <h2 className="mt-2 font-display text-[28px] font-semibold text-carbon md:text-[34px]">
                  You May Also Like
                </h2>

                <div className="mt-4 h-px w-14 bg-carbon" />
              </div>

              <Link
                href={`/collections/${product.category}`}
                className="hidden shrink-0 items-center gap-2 border-b border-carbon pb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-carbon sm:inline-flex"
              >
                View collection <span>→</span>
              </Link>
            </div>

            <ProductGrid products={related} />
          </section>
        )}
      </div>
    </div>
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