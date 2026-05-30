"use client";

import { useCallback, useRef, useState } from "react";

interface ProductGalleryProps {
  images: string[];
  emoji: string;
  alt: string;
  badge?: string;
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

export default function ProductGallery({
  images,
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const stageRef = useRef<HTMLDivElement>(null);

  const total = images.length;
  const hasImages = total > 0;

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;
      setActive((c) => (c + delta + total) % total);
    },
    [total],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  }

  function markFailed(i: number) {
    setFailed((f) => ({ ...f, [i]: true }));
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:gap-5">
      {/* Main stage */}
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-roledescription="carousel"
        aria-label={`${alt} images`}
        className="group relative aspect-square flex-1 overflow-hidden rounded-2xl border border-gold/25 bg-ivory focus:outline-none focus:ring-2 focus:ring-gold/60 sm:aspect-[4/5]"
      >
        {hasImages ? (
          images.map((img, i) => {
            const src = getImageSrc(img);
            const isActive = i === active;
            return (
              <div
                key={`${img}-${i}`}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  isActive ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {failed[i] || !src ? (
                  <div className="flex h-full w-full items-center justify-center text-7xl">
                    {emoji}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${alt} — view ${i + 1}`}
                    onError={() => markFailed(i)}
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                  />
                )}
              </div>
            );
          })
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">
            {emoji}
          </div>
        )}

        {badge && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-carbon px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-light">
            {badge}
          </span>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              →
            </button>
            <div className="absolute bottom-3 right-3 z-10 rounded-full bg-carbon/85 px-3 py-1 text-[11px] font-semibold text-gold-light shadow-sm">
              {active + 1} / {total}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail rail */}
      {total > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 lg:w-[78px] lg:flex-col lg:overflow-visible lg:pb-0">
          {images.map((img, i) => {
            const src = getImageSrc(img);
            const isActive = i === active;
            return (
              <button
                key={`${img}-thumb-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={isActive}
                className={`relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-ivory transition sm:h-[70px] sm:w-[70px] lg:h-auto lg:w-full ${
                  isActive
                    ? "border-carbon ring-1 ring-carbon"
                    : "border-gold/25 hover:border-gold"
                }`}
              >
                {failed[i] || !src ? (
                  <span className="flex h-full w-full items-center justify-center text-2xl">
                    {emoji}
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
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