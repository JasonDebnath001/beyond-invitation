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

function getImageSrc(img: string) {
  if (!img) return "";

  const value = img.trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (
    value.startsWith("/files/") ||
    value.startsWith("/private/files/")
  ) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(
      /\/$/,
      "",
    );

    return erpUrl ? `${erpUrl}${value}` : value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/products/${value}`;
}

function isYoutubeUrl(src: string) {
  return (
    src.includes("youtube.com/embed/") ||
    src.includes("youtube.com/watch") ||
    src.includes("youtube.com/shorts/") ||
    src.includes("youtu.be/")
  );
}

function isVimeoUrl(src: string) {
  return src.includes("vimeo.com/");
}

function isDirectVideo(src: string) {
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(
    src.split("?")[0],
  );
}

function isVideoLikeUrl(src: string) {
  return (
    isYoutubeUrl(src) ||
    isVimeoUrl(src) ||
    isDirectVideo(src)
  );
}

function isImageLikeUrl(src: string) {
  const value = src.trim();

  if (!value) {
    return false;
  }

  if (isVideoLikeUrl(value)) {
    return false;
  }

  const cleanPath = value.split("?")[0].toLowerCase();

  return (
    /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(cleanPath) ||
    value.startsWith("/files/") ||
    value.startsWith("/private/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
}

function getMainProductImage(images: string[] | undefined) {
  /*
   * ProductGallery does the following:
   *
   * 1. Removes empty image paths.
   * 2. Removes duplicate images.
   * 3. Removes videos from the image list.
   * 4. Reverses the image order.
   *
   * Therefore, the last valid ERPNext image becomes the
   * default main image in the product gallery.
   *
   * Product cards use the same logic here.
   */
  const cleanImages = Array.from(
    new Set(
      (images ?? [])
        .map((image) => image?.trim())
        .filter((image): image is string => Boolean(image)),
    ),
  )
    .filter(isImageLikeUrl)
    .reverse();

  return cleanImages[0] ?? "";
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  const [failed, setFailed] = useState(false);

  const discount = discountPercent(product);

  const isSaleCard =
    product.badge === "SALE" || product.onSale === true;

  const badge =
    product.badge ??
    (!isSaleCard && discount > 0
      ? `${discount}% OFF`
      : undefined);

  const mainImage = getMainProductImage(product.images);
  const src = mainImage ? getImageSrc(mainImage) : "";
  const showImage = Boolean(src && !failed);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-carbon/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-carbon/15 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)]">
      <div className="relative aspect-[4/4.6] overflow-hidden bg-white">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="flex h-full w-full items-center justify-center"
        >
          {showImage ? (
            <img
              src={src}
              alt={product.name}
              onError={() => setFailed(true)}
              className="h-full w-full object-contain p-5 transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl">
              {product.emoji}
            </div>
          )}
        </Link>

        {badge && (
          <span className="absolute left-4 top-4 z-10 rounded-full border border-carbon/10 bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#85172b] shadow-sm">
            {badge}
          </span>
        )}

        <WishlistButton
          productSlug={product.slug}
          className="absolute right-4 top-4 z-20 rounded-full bg-white shadow-sm"
        />
      </div>

      <div className="border-t border-carbon/5 bg-white p-4 sm:p-5">
        <Link
          href={`/products/${product.slug}`}
          className="block"
        >
          <h3 className="line-clamp-2 min-h-[42px] text-[15px] font-semibold leading-snug text-[#85172b] transition-colors group-hover:text-carbon">
            {product.name}
          </h3>
        </Link>

        <div className="mt-3 flex min-h-[28px] flex-wrap items-center gap-2">
          <span className="text-[18px] font-bold text-carbon">
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {product.mrp > product.price && (
            <span className="text-sm text-carbon/35 line-through">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}

          {!isSaleCard && discount > 0 && (
            <span className="rounded-full bg-[#f8ead0] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#85172b]">
              {discount}% off
            </span>
          )}
        </div>

        <div className="mt-4">
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}