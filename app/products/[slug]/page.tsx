import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getAllProductSlugs,
  getRelatedProducts,
} from "@/lib/products";
import { discountPercent } from "@/types";
import ImageSlider from "@/components/ImageSlider";
import AddToCartButton from "@/components/AddToCartButton";
import { ProductGrid } from "@/components/ProductGrid";

interface PageProps {
  params: Promise<{ slug: string }>;
}


/**
 * Pre-render a static page for every product at build time.
 * Add a product to products.json → a page is generated automatically.
 */
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Per-product SEO metadata. */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found – Shahi Cards" };
  return {
    title: `${product.name} – Shahi Cards`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const discount = discountPercent(product);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <nav className="mb-8 text-[13px] text-ink-light">
        <Link href="/" className="hover:text-maroon">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/collections/${product.category}`}
          className="capitalize hover:text-maroon"
        >
          {product.category.replace("-", " ")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-gold/25 bg-white">
          <ImageSlider
            images={product.images}
            emoji={product.emoji}
            alt={product.name}
            badge={product.badge}
            heightClass="h-[420px]"
          />
        </div>

        <div className="flex flex-col">
          {product.badge && (
            <span className="mb-3 w-fit rounded-full bg-gold-pale px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-maroon">
              {product.badge}
            </span>
          )}
          <h1 className="font-display text-3xl font-semibold leading-tight text-maroon-dark">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <span className="font-display text-3xl font-bold text-maroon">
              ₹{product.price.toLocaleString("en-IN")}
            </span>
            {product.mrp > product.price && (
              <span className="text-lg text-ink-light line-through">
                ₹{product.mrp.toLocaleString("en-IN")}
              </span>
            )}
            {discount > 0 && (
              <span className="rounded-xl bg-[#E8F7EE] px-2.5 py-1 text-[13px] font-semibold text-[#27A060]">
                {discount}% OFF
              </span>
            )}
          </div>

          <p className="mt-5 text-[15px] leading-relaxed text-ink-mid">
            {product.description}
          </p>

          <div className="my-6 h-px bg-gold/20" />

          <dl className="space-y-2 text-[14px]">
            <div className="flex gap-3">
              <dt className="w-28 text-ink-light">Category</dt>
              <dd className="capitalize text-ink">
                {product.category.replace("-", " ")}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 text-ink-light">Customization</dt>
              <dd className="text-ink">Free name &amp; details printing</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 text-ink-light">Delivery</dt>
              <dd className="text-ink">Pan India, 5–7 working days</dd>
            </div>
          </dl>

          <div className="mt-8 max-w-xs">
            <AddToCartButton product={product} large />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="mb-8 font-display text-2xl font-semibold text-maroon-dark">
            You May Also Like
          </h2>
          <ProductGrid products={related} />
        </div>
      )}
    </div>
  );
}
