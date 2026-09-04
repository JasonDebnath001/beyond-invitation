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
    <article className="group min-w-0 overflow-hidden rounded-[18px] border border-carbon/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-carbon/15 hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)] min-[400px]:rounded-[24px] sm:rounded-[28px]">
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
              className="h-full w-full object-contain p-2.5 transition-transform duration-700 ease-out group-hover:scale-[1.06] min-[400px]:p-4 sm:p-5"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl">
              {product.emoji}
            </div>
          )}
        </Link>

        {badge && (
          <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-4rem)] truncate rounded-full border border-carbon/10 bg-white/95 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[#85172b] shadow-sm min-[400px]:left-3 min-[400px]:top-3 min-[400px]:px-2.5 min-[400px]:text-[9px] sm:left-4 sm:top-4 sm:max-w-none sm:px-3 sm:text-[10px] sm:tracking-[0.16em]">
            {badge}
          </span>
        )}

        <WishlistButton
          productSlug={product.slug}
          className="absolute right-2 top-2 z-20 rounded-full bg-white shadow-sm min-[400px]:right-3 min-[400px]:top-3 sm:right-4 sm:top-4"
        />
      </div>

      <div className="border-t border-carbon/5 bg-white p-3 min-[400px]:p-4 sm:p-5">
        <Link href={`/products/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[36px] break-words text-[13px] font-semibold leading-snug text-[#85172b] transition-colors group-hover:text-carbon min-[400px]:min-h-[39px] min-[400px]:text-[14px] sm:min-h-[42px] sm:text-[15px]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2.5 flex min-h-[24px] flex-wrap items-center gap-x-1.5 gap-y-1 min-[400px]:mt-3 min-[400px]:gap-2 sm:min-h-[28px]">
          <span className="text-[15px] font-bold text-carbon min-[400px]:text-[17px] sm:text-[18px]">
            ₹{product.price.toLocaleString("en-IN")}
          </span>

          {product.mrp > product.price && (
            <span className="text-[11px] text-carbon/35 line-through min-[400px]:text-xs sm:text-sm">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}

          {!isSaleCard && discount > 0 && (
            <span className="rounded-full bg-[#f8ead0] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#85172b] min-[400px]:px-2 min-[400px]:text-[10px] sm:text-[11px]">
              {discount}% off
            </span>
          )}
        </div>

        <div className="mt-3 min-[400px]:mt-4">
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}
