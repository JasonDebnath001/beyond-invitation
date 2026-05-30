"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import AddToCartButton from "./AddToCartButton";

interface ProductCardProps {
  product: Product;
}

/** Resolve an image reference to a usable src (ERP URL or local /products file). */
function getImageSrc(img: string) {
  if (!img) return "";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  if (img.startsWith("/files/") || img.startsWith("/private/files/")) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");
    return erpUrl ? `${erpUrl}${img}` : img;
  }
  if (img.startsWith("/")) return img;
  return `/products/${img}`;
}

/**
 * A single product card — one image, name, price and add-to-cart.
 * Shows only the first image (no carousel); the full gallery lives on
 * the product detail page. Change this one file and every grid updates.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const [failed, setFailed] = useState(false);

  const discount = discountPercent(product);
  const badge =
    product.badge ?? (discount > 0 ? `${discount}% OFF` : undefined);

  const firstImage = product.images?.[0];
  const src = firstImage ? getImageSrc(firstImage) : "";
  const showImage = src && !failed;

  return (
    <div className="group flex flex-col">
      {/* Image */}
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-xl border border-gold/20 bg-ivory transition-colors duration-300 group-hover:border-gold"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={product.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ivory text-5xl">
            {product.emoji}
          </div>
        )}

        {badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-carbon px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gold-light shadow-sm">
            {badge}
          </span>
        )}
      </Link>

      {/* Details */}
      <div className="flex flex-1 flex-col pt-3">
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug text-carbon transition-colors group-hover:text-maroon-light sm:text-[14px]">
            {product.name}
          </h3>
        </Link>

        <div className="mb-3 mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[17px] font-semibold text-carbon sm:text-[19px]">
            &#8377;{product.price.toLocaleString("en-IN")}
          </span>
          {product.mrp > product.price && (
            <span className="text-[12px] text-ink-light line-through">
              &#8377;{product.mrp.toLocaleString("en-IN")}
            </span>
          )}
          {discount > 0 && (
            <span className="ml-auto text-[11px] font-semibold text-[#27A060]">
              {discount}% off
            </span>
          )}
        </div>

        <div className="mt-auto">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}