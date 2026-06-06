"use client";

import { useState } from "react";
import Link from "next/link";

import type { Product } from "@/types";
import { discountPercent } from "@/types";

import AddToCartButton from "./AddToCartButton";

interface ProductCardProps {
  product: Product;
}

/** Resolve an image reference to a usable src: ERP URL or local /products file. */
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
 * A single product card — one image, name, price and add-to-cart.
 * Shows only the first image; full gallery lives on the product detail page.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const [failed, setFailed] = useState(false);

  const discount = discountPercent(product);

  const isSaleCard = product.badge === "SALE" || product.onSale === true;

  const badge =
    product.badge ?? (!isSaleCard && discount > 0 ? `${discount}% OFF` : undefined);

  const firstImage = product.images?.[0];
  const src = firstImage ? getImageSrc(firstImage) : "";
  const showImage = src && !failed;

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={product.name}
              onError={() => setFailed(true)}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#f8f2ea] text-6xl">
              {product.emoji}
            </div>
          )}

          {badge && (
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-900 shadow-sm">
              {badge}
            </span>
          )}
        </div>
      </Link>

      <div className="space-y-4 p-5">
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 font-serif text-xl text-stone-950 transition hover:text-amber-700">
            {product.name}
          </h3>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold text-stone-950">
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {product.mrp > product.price && (
            <span className="text-sm text-stone-400 line-through">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}

          {!isSaleCard && discount > 0 && (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {discount}% off
            </span>
          )}
        </div>

        <AddToCartButton product={product} />
      </div>
    </article>
  );
}