"use client";

import { useCallback, useRef, useState } from "react";

interface ProductGalleryProps {
  images: string[];
  emoji: string;
  alt: string;
  badge?: string;
}

/** Resolve an image reference to a usable src: ERP URL or local /products file. */
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

type ImageSize = {
  width: number;
  height: number;
};

type ZoomPosition = {
  x: number;
  y: number;
};

const ZOOM_SCALE = 2.6;

export default function ProductGallery({
  images,
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({
    x: 50,
    y: 50,
  });
  const [imageSizes, setImageSizes] = useState<Record<number, ImageSize>>({});

  const stageRef = useRef<HTMLDivElement>(null);

  const total = images.length;
  const hasImages = total > 0;
  const activeSrc = hasImages ? getImageSrc(images[active]) : "";

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;

      setZoomVisible(false);
      setActive((current) => (current + delta + total) % total);
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
    setFailed((current) => ({ ...current, [i]: true }));
  }

  function saveImageSize(i: number, img: HTMLImageElement) {
    setImageSizes((current) => ({
      ...current,
      [i]: {
        width: img.naturalWidth,
        height: img.naturalHeight,
      },
    }));
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    const imageSize = imageSizes[active];

    if (!stage || !imageSize || failed[active] || !activeSrc) {
      setZoomVisible(false);
      return;
    }

    const rect = stage.getBoundingClientRect();

    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const imageAspect = imageSize.width / imageSize.height;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth = containerWidth;
    let renderedHeight = containerHeight;
    let offsetX = 0;
    let offsetY = 0;

    /**
     * Because the image uses object-contain, the visible image may have
     * empty space on the sides or top/bottom. This calculates the actual
     * rendered image area inside the container.
     */
    if (imageAspect > containerAspect) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageAspect;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageAspect;
      offsetX = (containerWidth - renderedWidth) / 2;
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imageX = mouseX - offsetX;
    const imageY = mouseY - offsetY;

    const isInsideImage =
      imageX >= 0 &&
      imageX <= renderedWidth &&
      imageY >= 0 &&
      imageY <= renderedHeight;

    if (!isInsideImage) {
      setZoomVisible(false);
      return;
    }

    const xPercent = (imageX / renderedWidth) * 100;
    const yPercent = (imageY / renderedHeight) * 100;

    setZoomPosition({
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent)),
    });

    setZoomVisible(true);
  }

  function handleMouseLeave() {
    setZoomVisible(false);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:gap-5">
      {/* Main stage */}
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-roledescription="carousel"
        aria-label={`${alt} images`}
        className="group relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-2xl border border-gold/25 bg-ivory focus:outline-none focus:ring-2 focus:ring-gold/60 sm:aspect-[4/5]"
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
                    onLoad={(event) => saveImageSize(i, event.currentTarget)}
                    onError={() => markFailed(i)}
                    className="h-full w-full object-contain p-3"
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

        {/* Amazon-style hover zoom overlay */}
        {zoomVisible && activeSrc && !failed[active] && (
          <div className="pointer-events-none absolute inset-0 z-20 hidden overflow-hidden bg-ivory md:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt={`${alt} zoomed view`}
              className="h-full w-full object-contain p-3"
              style={{
                transform: `scale(${ZOOM_SCALE})`,
                transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
              }}
            />

            <div className="absolute bottom-3 left-3 rounded-full bg-carbon/85 px-3 py-1 text-[11px] font-semibold text-gold-light shadow-sm">
              Move mouse to zoom
            </div>
          </div>
        )}

        {badge && (
          <span className="absolute left-4 top-4 z-30 rounded-full bg-carbon px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-light">
            {badge}
          </span>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              →
            </button>

            <div className="absolute bottom-3 right-3 z-30 rounded-full bg-carbon/85 px-3 py-1 text-[11px] font-semibold text-gold-light shadow-sm">
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
                onClick={() => {
                  setZoomVisible(false);
                  setActive(i);
                }}
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
                    className="h-full w-full object-contain p-1"
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