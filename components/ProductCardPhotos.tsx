"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Search } from "lucide-react";
import type { Product } from "@/types";
import { getProductCardImages } from "@/lib/product-card-media";
import Link from "@/components/NavigationLink";
import ProductImage from "@/components/ProductImage";
import AddToCartButton from "@/components/AddToCartButton";

interface CardPhotosProps {
  product: Product;
  title: string;
  initialPhotos: string[];
  imageCount: number;
  imageSizes: string;
  priority: boolean;
  discount: number;
  placeholderLabel: string;
}

const reveal =
  "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none";

export default function ProductCardPhotos({
  product,
  title,
  initialPhotos,
  imageCount,
  imageSizes,
  priority,
  discount,
  placeholderLabel,
}: CardPhotosProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [active, setActive] = useState(0);
  const [complete, setComplete] = useState(initialPhotos.length >= imageCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const src = photos[active] || "";
  const total = complete ? photos.length : Math.max(photos.length, imageCount);
  const hasImage = Boolean(src && !failed.has(src));

  async function changePhoto(direction: number) {
    if (request.current) return;
    setError("");
    if (complete) {
      if (photos.length)
        setActive(
          (current) => (current + direction + photos.length) % photos.length,
        );
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/catalog/products/${encodeURIComponent(product.slug)}/images`,
        {
          signal: controller.signal,
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!response.ok) throw new Error("Gallery unavailable");
      const data = await response.json();
      if (
        !Array.isArray(data.images) ||
        !data.images.every((image: unknown) => typeof image === "string")
      )
        throw new Error("Invalid gallery");
      if (controller.signal.aborted) return;
      const nextPhotos = getProductCardImages(data.images);
      setPhotos(nextPhotos);
      setComplete(true);
      const current = Math.max(0, nextPhotos.indexOf(src));
      setActive(nextPhotos.length ? (current + direction + nextPhotos.length) % nextPhotos.length : 0);
    } catch {
      if (!controller.signal.aborted)
        setError("Photos couldn't load. Try the arrow again.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }

  return (
    <div className="relative isolate">
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${title}`}
        className="product-card-image relative flex aspect-square w-full items-center justify-center overflow-hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-carbon"
      >
        {hasImage ? (
          <ProductImage
            key={src}
            src={src}
            alt={title}
            fill
            sizes={imageSizes}
            quality={75}
            storageTransform
            priority={priority && active === 0}
            loading={priority || active > 0 ? "eager" : "lazy"}
            decoding="async"
            unoptimized={src.startsWith("http://")}
            onError={() => setFailed((current) => new Set(current).add(src))}
            className="object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-neutral-400">
            <ImageOff aria-hidden="true" className="h-8 w-8" strokeWidth={1} />
            <span className="text-xs">{placeholderLabel}</span>
          </div>
        )}
      </Link>

      {discount > 0 && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 bg-[#df270d] px-3 py-1 text-[11px] font-medium leading-4 text-white">
          −{discount}%
        </span>
      )}

      <Link
        href={`/products/${product.slug}`}
        aria-label={`View details of ${title}`}
        className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-500 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon ${reveal}`}
      >
        <Search
          aria-hidden="true"
          className="h-[17px] w-[17px]"
          strokeWidth={1.5}
        />
      </Link>

      {total > 1 && (
        <>
          {[-1, 1].map((direction) => (
            <button
              key={direction}
              type="button"
              disabled={loading}
              onClick={() => void changePhoto(direction)}
              aria-label={`${direction < 0 ? "Previous" : "Next"} photo of ${title}`}
              className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon disabled:cursor-wait disabled:opacity-40 ${direction < 0 ? "left-1.5" : "right-1.5"} ${reveal}`}
            >
              {direction < 0 ? (
                <ChevronLeft
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={1.7}
                />
              ) : (
                <ChevronRight
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={1.7}
                />
              )}
            </button>
          ))}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-8 bottom-1.5 flex justify-center gap-1 overflow-hidden ${reveal}`}
          >
            {Array.from({ length: Math.min(total, 20) }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 shrink-0 rounded-full border border-neutral-500/70 ${index === active ? "bg-neutral-600" : "bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="product-card-cart absolute inset-x-3 bottom-4 z-10">
        <AddToCartButton product={product} variant="card" />
      </div>
      <span role="status" className="sr-only">
        {loading
          ? "Loading product photos"
          : total
            ? `Photo ${active + 1} of ${total}`
            : ""}
      </span>
      {error && (
        <p
          role="alert"
          className="absolute inset-x-2 bottom-16 z-20 bg-white/95 px-2 py-1 text-center text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
