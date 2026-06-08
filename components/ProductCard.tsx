"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "./WishlistButton";

interface ProductCardProps {
  product: Product;
}

/**
 * Resolve an image reference to a usable src:
 * - Full ERP/public URL
 * - ERPNext /files path
 * - Local /public path
 * - Local /public/products fallback
 */
function getImageSrc(img: string) {
  if (!img) return "";

  if (img.startsWith("http://") || img.startsWith("https://")) {
    return img;
  }

  if (img.startsWith("/files/") || img.startsWith("/private/files/")) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");
    return erpUrl ? `${erpUrl}${img}` : img;
  }

  if (img.startsWith("/")) {
    return img;
  }

  return `/products/${img}`;
}

/**
 * A single product card:
 * image, badge, wishlist button, name, price and add-to-cart.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const [failed, setFailed] = useState(false);

  const discount = discountPercent(product);
  const isSaleCard = product.badge === "SALE" || product.onSale === true;

  const badge =
    product.badge ?? (!isSaleCard && discount > 0 ? `${discount}% OFF` : undefined);

  const firstImage = product.images?.[0];
  const src = firstImage ? getImageSrc(firstImage) : "";
  const showImage = Boolean(src && !failed);

  return (
    <article className="group overflow-hidden rounded-3xl border border-carbon/10 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/5] overflow-hidden bg-paper">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="block h-full w-full"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={product.name}
              onError={() => setFailed(true)}
              className="h-full w object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-paper text-6xl">
              {product.emoji}
            </div>
          )}
        </Link>

        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon shadow-sm">
            {badge}
          </span>
        )}

        <WishlistButton
          productSlug={product.slug}
          className="absolute right-3 top-3 z-20"
        />
      </div>

      <div className="space-y-3 p-4">
        <Link href={`/products/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[44px] text-base font-semibold leading-snug text-carbon transition-colors group-hover:text-carbon/75">
            {product.name}
          </h3>
        </Link>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold text-carbon">
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {product.mrp > product.price && (
            <span className="text-sm text-carbon/45 line-through">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}

          {!isSaleCard && discount > 0 && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              {discount}% off
            </span>
          )}
        </div>

        <AddToCartButton product={product} />
      </div>
    </article>
  );
}