"use client";

import { useState } from "react";

interface ImageSliderProps {
  /** Image file names — resolved against /public/products/ */
  images: string[];
  /** Emoji fallback shown when an image fails to load or list is empty */
  emoji: string;
  /** Alt text base for accessibility */
  alt: string;
  /** Optional badge text rendered top-left */
  badge?: string;
  /** Show the thumbnail strip below the slider (used on cards) */
  showThumbnails?: boolean;
  /** Slider height class — cards use a fixed height, detail page a taller one */
  heightClass?: string;
}

/**
 * A self-contained image carousel. All slider state lives in this component,
 * so any number of sliders can exist on a page without ID collisions —
 * the core problem with the old vanilla-JS version.
 */
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
    setCurrent((c) => (c + delta + total) % total);
  }

  function markFailed(index: number) {
    setFailed((f) => ({ ...f, [index]: true }));
  }

  return (
    <div>
      <div
        className={`relative ${heightClass} overflow-hidden bg-gold-pale`}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {hasImages ? (
            images.map((img, i) => (
              <div
                key={img}
                className="flex h-full w-full shrink-0 items-center justify-center bg-gold-pale text-6xl"
              >
                {failed[i] ? (
                  <span aria-hidden>{emoji}</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/products/${img}`}
                    alt={`${alt} — image ${i + 1}`}
                    onError={() => markFailed(i)}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl">
              <span aria-hidden>{emoji}</span>
            </div>
          )}
        </div>

        {badge && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-maroon px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gold-light">
            {badge}
          </span>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-maroon shadow transition hover:scale-110 hover:bg-white"
            >
              &#8592;
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-maroon shadow transition hover:scale-110 hover:bg-white"
            >
              &#8594;
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-4 bg-white" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>

            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {current + 1} / {total}
            </span>
          </>
        )}
      </div>

      {showThumbnails && total > 1 && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1}`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border-[1.5px] bg-gold-pale text-lg transition ${
                i === current ? "border-maroon" : "border-gold/25"
              }`}
            >
              {failed[i] ? (
                <span aria-hidden>{emoji}</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/products/${img}`}
                  alt=""
                  onError={() => markFailed(i)}
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
