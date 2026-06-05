import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

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

/** Resolve a product from local JSON first, then ERPNext (if configured). */
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

const FEATURES = [
  {
    icon: "✍️",
    title: "Free personalisation",
    text: "Names & details printed",
  },
  { icon: "", title: "Pan-India delivery", text: "5–7 working days" },
  { icon: "", title: "Premium finish", text: "Carefully packed" },
];

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

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          {/* Gallery */}
          <ProductGallery
            images={product.images}
            videos={product.videos}
            emoji={product.emoji}
            alt={product.name}
            badge={product.badge}
          />

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold">
              <span>{categoryLabel}</span>

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

            {product.description && (
              <div className="mt-6 text-[15px] leading-relaxed text-ink-mid">
                {hasHtml(product.description) ? (
                  <div
                    className="space-y-3 [&_li]:ml-4 [&_li]:list-disc"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                ) : (
                  <p className="whitespace-pre-line">{product.description}</p>
                )}
              </div>
            )}

            <div className="my-7 h-px w-full bg-gradient-to-r from-gold/30 via-gold/15 to-transparent" />

            <ProductBuyBox product={product} />

            <div className="mt-8 grid grid-cols-3 gap-2.5 sm:gap-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-gold/20 bg-paper px-3 py-4 text-center"
                >
                  <div className="text-xl">{f.icon}</div>

                  <p className="mt-2 text-[12px] font-semibold leading-tight text-carbon">
                    {f.title}
                  </p>

                  <p className="mt-0.5 text-[11px] leading-tight text-ink-light">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mt-12 max-w-3xl sm:mt-16">
          <Accordion title="Product Details" defaultOpen>
            <ul className="space-y-2.5 text-[14px] text-ink-mid">
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

          <Accordion title="Shipping & Returns">
            <p className="text-[14px] leading-relaxed text-ink-mid">
              Delivered pan-India within 5–7 working days after proof approval.
              Because every card is personalised and printed to order,
              we&apos;re unable to accept returns — but we&apos;ll gladly
              reprint if there&apos;s a printing error on our side.
            </p>
          </Accordion>
        </div>

        {/* Related */}
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

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-gold/10 pb-2.5">
      <span className="w-32 shrink-0 text-ink-light">{label}</span>
      <span className="text-ink">{value}</span>
    </li>
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-t border-gold/20 last:border-b"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-display text-[18px] font-semibold text-carbon marker:hidden [&::-webkit-details-marker]:hidden">
        {title}

        <span className="ml-4 text-gold transition-transform duration-200 group-open:rotate-45">
          ＋
        </span>
      </summary>

      <div className="pb-6 pr-2">{children}</div>
    </details>
  );
}
