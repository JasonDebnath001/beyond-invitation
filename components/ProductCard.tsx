"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";

import type { Product } from "@/types";
import { discountPercent } from "@/types";
import { getProductQuantityRules } from "@/lib/product-quantity";
import { formatProductName } from "@/lib/product-name";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "./WishlistButton";
import ProductPrice from "./ProductPrice";

interface ProductCardProps {
  product: Product & { subject?: string };
  categoryLabel?: string;
}

const categoryLabels: Record<Product["category"], string> = {
  wedding: "Wedding invitation",
  housewarming: "Housewarming",
  "thread-ceremony": "Thread ceremony",
  "naming-ceremony": "Naming ceremony",
  birthday: "Birthday invitation",
  "baby-shower": "Baby shower",
  luxe: "Luxe collection",
};

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
    value.includes("/storage/v1/object/public/") ||
    value.startsWith("/files/") ||
    value.includes("/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
}

function getMainProductImage(images: string[] | undefined) {
  // The catalogue supplies the primary image first, followed by gallery order.

  const cleanImages = Array.from(
    new Set(
      (images ?? [])
        .map((image) => image?.trim())
        .filter((image): image is string => Boolean(image)),
    ),
  ).filter(isImageLikeUrl);

  return cleanImages[0] ?? "";
}

export default function ProductCard({ product, categoryLabel }: ProductCardProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const productName = formatProductName(product.name, product.itemCode);

  const discount = discountPercent(product);
  const hasPrice = Number.isFinite(product.price) && product.price > 0;
  const { minimum } = getProductQuantityRules(product);
  const badge = product.badge || (product.onSale ? "On sale" : product.isPremium ? "Premium" : "");
  const label = categoryLabel || product.subject || categoryLabels[product.category];

  const mainImage = getMainProductImage(product.images);
  const src = mainImage ? getImageSrc(mainImage) : "";
  const showImage = Boolean(src && failedSrc !== src);

  return (
    <article className="product-card group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#e9e1d7] bg-white transition-[border-color,box-shadow] duration-[240ms] hover:border-[#ccb894] hover:shadow-[0_8px_24px_rgba(42,24,16,0.08)] focus-within:border-carbon/40 focus-within:shadow-[0_8px_24px_rgba(42,24,16,0.08)] motion-reduce:transition-none">
      <div className="relative isolate m-1.5 mb-0 overflow-hidden rounded-lg bg-[#f8f5f0] sm:m-2 sm:mb-0">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${productName}`}
          className="product-card-image relative flex aspect-square w-full items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-carbon"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={productName}
              loading="lazy"
              decoding="async"
              onError={() => setFailedSrc(src)}
              className="h-full w-full object-contain p-2 transition-transform duration-[240ms] group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none sm:p-3"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-[#8b7561]">
              <ImageOff aria-hidden="true" className="h-8 w-8" strokeWidth={1} />
              <span className="text-xs">Image coming soon</span>
            </div>
          )}
        </Link>

        {badge && (
          <span title={badge} className="pointer-events-none absolute left-0 top-3 z-10 max-w-[calc(100%-3.5rem)] truncate rounded-r-sm border-l-2 border-[#b38a45] bg-[#f4e7cb] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#63491f] sm:px-2.5 sm:text-[10px]">
            {badge}
          </span>
        )}

        <WishlistButton
          productSlug={product.slug}
          className="absolute right-1 top-1 z-20 sm:right-2 sm:top-2"
        />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
        <p title={label} className="mb-1.5 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#8b6f47] sm:text-[10px]">
          {label}
        </p>
        <Link href={`/products/${product.slug}`} className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2">
          <h3 title={productName} className="min-h-[2.75rem] break-words text-sm font-semibold leading-[1.375rem] text-[#2a1810] transition-colors duration-[240ms] group-hover:text-carbon sm:text-[15px]">
            {productName}
          </h3>
        </Link>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2">
          <ProductPrice
            price={product.price}
            mrp={product.mrp}
            priceClassName={hasPrice ? "text-lg font-bold leading-6 tracking-tight text-[#2a1810] sm:text-xl" : "text-sm font-semibold leading-6 text-[#2a1810]"}
            oldPriceClassName="text-xs text-[#85776b] sm:text-[13px]"
          />
          {discount > 0 && (
            <span className="whitespace-nowrap text-[11px] font-bold text-[#3f6b4e] sm:text-xs">
              {discount}% off
            </span>
          )}
        </div>

        <p className="mt-1 text-[11px] leading-4 text-[#78695d] sm:text-xs">
          {hasPrice && <span>Per piece <span aria-hidden="true">&middot;</span> </span>}
          Min. {minimum} pieces
        </p>

        <div className="mt-auto pt-3.5">
          <AddToCartButton product={product} variant="card" />
        </div>
      </div>
    </article>
  );
}
