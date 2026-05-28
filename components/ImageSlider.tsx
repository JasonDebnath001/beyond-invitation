"use client";

import { useState } from "react";

interface ImageSliderProps {
  images: string[];
  emoji: string;
  alt: string;
  badge?: string;
  showThumbnails?: boolean;
  heightClass?: string;
}

function getImageSrc(img: string) {
  if (!img) return "";

  // ERPNext / external full image URL
  if (img.startsWith("http://") || img.startsWith("https://")) {
    return img;
  }

  // ERPNext relative public/private file path converted earlier or passed directly
  if (img.startsWith("/files/") || img.startsWith("/private/files/")) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");

    if (erpUrl) {
      return `${erpUrl}${img}`;
    }

    return img;
  }

  // Already a public path inside Next.js app
  if (img.startsWith("/")) {
    return img;
  }

  // Old website behavior: local images from /public/products
  return `/products/${img}`;
}

export default function ImageSlider({
  images,
  emoji,
  alt,
  badge,
  showThumbnails = false,
  heightClass = "h-56",
}: ImageSliderProps) {
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const total = images.length;
  const hasImages = total > 0;

  function go(delta: number) {
    if (total === 0) return;
    setCurrent((c) => (c + delta + total) % total);
  }

  function markFailed(index: number) {
    setFailed((f) => ({ ...f, [index]: true }));
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative overflow-hidden rounded-[1.75rem] bg-ivory ${heightClass}`}
      >
        {hasImages ? (
          images.map((img, i) => {
            const src = getImageSrc(img);

            return (
              <div
                key={`${img}-${i}`}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  i === current ? "opacity-100" : "opacity-0"
                }`}
              >
                {failed[i] || !src ? (
                  <div className="flex h-full w-full items-center justify-center bg-ivory text-6xl">
                    {emoji}
                  </div>
                ) : (
                  <img
                    src={src}
                    alt={`${alt} ${i + 1}`}
                    onError={() => markFailed(i)}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            );
          })
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ivory text-6xl">
            {emoji}
          </div>
        )}

        {badge && (
          <span className="absolute left-4 top-4 rounded-full bg-carbon px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {badge}
          </span>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-carbon shadow-sm transition hover:scale-105"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-carbon shadow-sm transition hover:scale-105"
            >
              →
            </button>

            <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-carbon shadow-sm">
              {current + 1} / {total}
            </div>
          </>
        )}
      </div>

      {showThumbnails && total > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => {
            const src = getImageSrc(img);

            return (
              <button
                key={`${img}-thumb-${i}`}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Show image ${i + 1}`}
                className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-neutral-100 text-lg transition ${
                  i === current ? "border-carbon" : "border-neutral-200"
                }`}
              >
                {failed[i] || !src ? (
                  <span>{emoji}</span>
                ) : (
                  <img
                    src={src}
                    alt={`${alt} thumbnail ${i + 1}`}
                    onError={() => markFailed(i)}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}