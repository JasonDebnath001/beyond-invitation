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

function isPrivateFileUrl(src?: string) {
  if (!src) return false;

  const value = src.trim().toLowerCase();

  return value.startsWith("/private/files/") || value.includes("/private/files/");
}

function getImageSrc(img: string) {
  if (!img) return "";

  const value = img.trim();

  if (!value) return "";

  if (isPrivateFileUrl(value)) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/files/")) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");
    return erpUrl ? `${erpUrl}${value}` : value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/products/${value}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCleanPath(src: string) {
  return safeDecode(src.trim()).split("?")[0].split("#")[0].toLowerCase();
}

function isYoutubeUrl(src: string) {
  const value = src.toLowerCase();

  return (
    value.includes("youtube.com/embed/") ||
    value.includes("youtube.com/watch") ||
    value.includes("youtube.com/shorts/") ||
    value.includes("youtu.be/")
  );
}

function isVimeoUrl(src: string) {
  return src.toLowerCase().includes("vimeo.com/");
}

function isDirectVideo(src: string) {
  const cleanPath = getCleanPath(src);

  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanPath);
}

function isVideoLikeUrl(src: string) {
  return isYoutubeUrl(src) || isVimeoUrl(src) || isDirectVideo(src);
}

function isImageLikeUrl(src: string) {
  const value = src.trim();

  if (!value) return false;
  if (isPrivateFileUrl(value)) return false;
  if (isVideoLikeUrl(value)) return false;

  const cleanPath = getCleanPath(value);

  return (
    /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/i.test(cleanPath) ||
    value.startsWith("/files/") ||
    value.includes("/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
}

function getMainProductImage(images: string[] | undefined) {
  /*
   * Product images now arrive from ERPNext sorted by File.custom_photo_order.
   *
   * photo order 1 = main product image
   * photo order 2 = second gallery image
   * photo order 3 = third gallery image
   *
   * So the product card should use the FIRST valid image.
   * Do NOT reverse the list here.
   */

  const cleanImages = Array.from(
    new Set(
      (images ?? [])
        .map((image) => image?.trim())
        .filter((image): image is string => Boolean(image)),
    ),
  ).filter(isImageLikeUrl);

  return cleanImages[0] ?? "";
}

export default function ProductCard({ product }: ProductCardProps) {
  const [failed, setFailed] = useState(false);

  const discount = discountPercent(product);
  const isSaleCard = product.badge === "SALE" || product.onSale === true;

  const badge =
    product.badge ?? (!isSaleCard && discount > 0 ? `${discount}% OFF` : undefined);

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
            // eslint-disable-next-line @next/next/no-img-element
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
        <Link href={`/products/${product.slug}`} className="block">
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