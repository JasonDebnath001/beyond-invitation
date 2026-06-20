"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

interface ProductGalleryProps {
  images: string[];
  videos?: string[];
  emoji: string;
  alt: string;
  badge?: string;
}

type GalleryItem =
  | {
      type: "image";
      src: string;
    }
  | {
      type: "video";
      src: string;
    };

interface ZoomPosition {
  x: number;
  y: number;
}

interface ImageSize {
  width: number;
  height: number;
}

const ZOOM_SCALE = 2;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|m4v)$/i;

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

function hasImageExtension(src: string) {
  return IMAGE_EXTENSIONS.test(getCleanPath(src));
}

function hasVideoExtension(src: string) {
  const cleanPath = getCleanPath(src);

  if (VIDEO_EXTENSIONS.test(cleanPath)) {
    return true;
  }

  const decoded = safeDecode(src.trim()).toLowerCase();

  return /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#&/])/i.test(decoded);
}

function isPrivateFileUrl(src?: string) {
  if (!src) return false;

  const value = src.trim().toLowerCase();

  return (
    value.startsWith("/private/files/") || value.includes("/private/files/")
  );
}

function getPublicFileSrc(src: string) {
  if (!src) return "";

  const value = src.trim();

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

function getImageSrc(img: string) {
  return getPublicFileSrc(img);
}

function getYoutubeVideoId(src: string) {
  try {
    const url = new URL(src.trim());

    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || "";
      }

      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || "";
      }

      if (url.pathname.startsWith("/live/")) {
        return url.pathname.split("/")[2] || "";
      }
    }

    if (url.hostname === "youtu.be" || url.hostname.endsWith(".youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    return "";
  } catch {
    return "";
  }
}

function isYoutubeUrl(src: string) {
  return Boolean(getYoutubeVideoId(src));
}

function toYoutubeEmbedUrl(src: string) {
  const id = getYoutubeVideoId(src);

  if (!id) {
    return src;
  }

  const embed = new URL(`https://www.youtube.com/embed/${id}`);

  embed.searchParams.set("autoplay", "1");
  embed.searchParams.set("mute", "1");
  embed.searchParams.set("muted", "1");
  embed.searchParams.set("controls", "0");
  embed.searchParams.set("playsinline", "1");
  embed.searchParams.set("rel", "0");
  embed.searchParams.set("loop", "1");
  embed.searchParams.set("playlist", id);
  embed.searchParams.set("modestbranding", "1");
  embed.searchParams.set("disablekb", "1");
  embed.searchParams.set("fs", "0");

  return embed.toString();
}

function isVimeoUrl(src: string) {
  return src.includes("vimeo.com/");
}

function toVimeoEmbedUrl(src: string) {
  try {
    const url = new URL(src);

    if (url.hostname.includes("player.vimeo.com")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("muted", "1");
      url.searchParams.set("background", "1");
      url.searchParams.set("controls", "0");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("loop", "1");

      return url.toString();
    }

    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];

      if (!id) {
        return src;
      }

      const embed = new URL(`https://player.vimeo.com/video/${id}`);

      embed.searchParams.set("autoplay", "1");
      embed.searchParams.set("muted", "1");
      embed.searchParams.set("background", "1");
      embed.searchParams.set("controls", "0");
      embed.searchParams.set("playsinline", "1");
      embed.searchParams.set("loop", "1");

      return embed.toString();
    }

    return src;
  } catch {
    return src;
  }
}

function getVideoSrc(src: string) {
  if (!src) return "";

  if (isYoutubeUrl(src)) {
    return toYoutubeEmbedUrl(src);
  }

  if (isVimeoUrl(src)) {
    return toVimeoEmbedUrl(src);
  }

  return getPublicFileSrc(src);
}

function withAutoplayParams(src: string) {
  try {
    const url = new URL(src);

    url.searchParams.set("autoplay", "1");
    url.searchParams.set("mute", "1");
    url.searchParams.set("muted", "1");
    url.searchParams.set("playsinline", "1");
    url.searchParams.set("controls", "0");
    url.searchParams.set("loop", "1");

    return url.toString();
  } catch {
    return (
      src +
      (src.includes("?") ? "&" : "?") +
      "autoplay=1&mute=1&muted=1&playsinline=1&controls=0&loop=1"
    );
  }
}

function isEmbeddableVideo(src: string) {
  return (
    src.includes("youtube.com/embed/") || src.includes("player.vimeo.com/video/")
  );
}

function isDirectVideo(src: string) {
  return hasVideoExtension(src);
}

function isVideoLikeUrl(src: string) {
  return (
    isYoutubeUrl(src) ||
    isVimeoUrl(src) ||
    isDirectVideo(src) ||
    hasVideoExtension(src)
  );
}

function isImageLikeUrl(src: string) {
  const value = src.trim();

  if (!value) return false;
  if (isPrivateFileUrl(value)) return false;
  if (isVideoLikeUrl(value)) return false;

  if (hasImageExtension(value)) return true;

  if (value.startsWith("/files/") || value.includes("/files/")) {
    return true;
  }

  if (!value.startsWith("http")) {
    return true;
  }

  return false;
}

function cleanMediaList(list: string[] = []) {
  return Array.from(
    new Set(
      list
        .map((src) => src?.trim())
        .filter((src): src is string => Boolean(src))
        .filter((src) => !isPrivateFileUrl(src)),
    ),
  );
}

function canonicalMediaKey(src: string) {
  const trimmed = src.trim();

  const youtubeId = getYoutubeVideoId(trimmed);

  if (youtubeId) {
    return `youtube:${youtubeId}`;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("vimeo.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];

      if (id) {
        return `vimeo:${id}`;
      }
    }

    return safeDecode(url.toString()).replace(/\/$/, "").toLowerCase();
  } catch {
    return safeDecode(trimmed).replace(/\/$/, "").toLowerCase();
  }
}

export default function ProductGallery({
  images,
  videos = [],
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [failedMediaKeys, setFailedMediaKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({
    x: 50,
    y: 50,
  });
  const [imageSizes, setImageSizes] = useState<Record<string, ImageSize>>({});

  const stageRef = useRef<HTMLDivElement | null>(null);

  const allMedia: GalleryItem[] = useMemo(() => {
    const cleanVideos = cleanMediaList(videos).filter(isVideoLikeUrl);
    const videoKeys = new Set(cleanVideos.map(canonicalMediaKey));

    const cleanImages = cleanMediaList(images)
      .filter((src) => !videoKeys.has(canonicalMediaKey(src)))
      .filter(isImageLikeUrl)
      .reverse();

    return [
      ...cleanImages.map((src) => ({
        type: "image" as const,
        src,
      })),

      ...cleanVideos.map((src) => ({
        type: "video" as const,
        src,
      })),
    ];
  }, [images, videos]);

  const media = useMemo(() => {
    return allMedia.filter((item) => !failedMediaKeys.has(canonicalMediaKey(item.src)));
  }, [allMedia, failedMediaKeys]);

  const total = media.length;
  const hasMedia = total > 0;
  const activeItem = hasMedia ? media[Math.min(active, total - 1)] : null;
  const activeKey = activeItem ? canonicalMediaKey(activeItem.src) : "";

  const activeSrc =
    activeItem?.type === "image"
      ? getImageSrc(activeItem.src)
      : activeItem?.type === "video"
        ? getVideoSrc(activeItem.src)
        : "";

  useEffect(() => {
    if (active >= total && total > 0) {
      setActive(total - 1);
    }

    if (total === 0 && active !== 0) {
      setActive(0);
    }
  }, [active, total]);

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;

      setZoomVisible(false);

      setActive((current) => {
        return (current + delta + total) % total;
      });
    },
    [total],
  );

  function removeBrokenMedia(item: GalleryItem, index: number) {
    const key = canonicalMediaKey(item.src);

    setFailedMediaKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    setZoomVisible(false);

    setActive((current) => {
      if (index < current) {
        return Math.max(0, current - 1);
      }

      if (index === current) {
        return Math.max(0, Math.min(current, total - 2));
      }

      return current;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  }

  function saveImageSize(key: string, image: HTMLImageElement) {
    setImageSizes((current) => ({
      ...current,
      [key]: {
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    }));
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (activeItem?.type !== "image") {
      setZoomVisible(false);
      return;
    }

    const stage = stageRef.current;
    const imageSize = imageSizes[activeKey];

    if (!stage || !imageSize || !activeSrc) {
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

    if (imageAspect > containerAspect) {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageAspect;
      offsetY = (containerHeight - renderedHeight) / 2;
    } else {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageAspect;
      offsetX = (containerWidth - renderedWidth) / 2;
    }

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

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

  function renderThumbnails(isDesktop = false) {
    if (total <= 1) {
      return null;
    }

    return (
      <div
        className={
          isDesktop
            ? "hidden xl:grid xl:w-20 xl:grid-cols-1 xl:content-start xl:gap-3 2xl:w-24"
            : "mt-3 grid grid-cols-4 gap-2 sm:mt-4 sm:grid-cols-6 sm:gap-3 md:grid-cols-8 xl:hidden"
        }
      >
        {media.map((item, index) => {
          const isActive = index === active;

          const src =
            item.type === "image" ? getImageSrc(item.src) : getVideoSrc(item.src);

          if (!src) {
            return null;
          }

          return (
            <button
              key={`${item.type}-${item.src}-${index}`}
              type="button"
              onClick={() => {
                setZoomVisible(false);
                setActive(index);
              }}
              aria-label={`View ${item.type} ${index + 1}`}
              aria-current={isActive}
              className={`relative aspect-square w-full overflow-hidden rounded-xl border bg-ivory transition ${
                isActive
                  ? "border-carbon ring-1 ring-carbon"
                  : "border-gold/25 hover:border-gold"
              }`}
            >
              {item.type === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-carbon text-base text-white sm:text-lg">
                  ▶
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={`${alt} thumbnail ${index + 1}`}
                  onError={() => removeBrokenMedia(item, index)}
                  className="h-full w-full object-contain p-1"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-[80px_minmax(0,1fr)] 2xl:grid-cols-[96px_minmax(0,1fr)]"
      onKeyDown={onKeyDown}
    >
      {renderThumbnails(true)}

      <div className="min-w-0 overflow-hidden">
        <div
          ref={stageRef}
          tabIndex={0}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="group relative flex aspect-square min-h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-gold/20 bg-ivory shadow-sm outline-none sm:min-h-[420px] sm:rounded-[2rem] xl:min-h-0"
        >
          {hasMedia && activeItem ? (
            <>
              {activeItem.type === "image" ? (
                activeSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSrc}
                    alt={alt}
                    onLoad={(event) => {
                      saveImageSize(activeKey, event.currentTarget);
                    }}
                    onError={() => removeBrokenMedia(activeItem, active)}
                    className="h-full w-full object-contain p-2 sm:p-3"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl sm:text-7xl">
                    {emoji}
                  </div>
                )
              ) : isEmbeddableVideo(activeSrc) ? (
                <div className="relative h-full w-full overflow-hidden bg-black">
                  <iframe
                    src={withAutoplayParams(activeSrc)}
                    title={`${alt} video`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute left-1/2 top-1/2 h-full w-[178%] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
                  />
                </div>
              ) : isDirectVideo(activeSrc) ? (
                <video
                  src={activeSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => removeBrokenMedia(activeItem, active)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <a
                  href={activeSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-carbon px-5 py-3 text-sm font-semibold text-white"
                >
                  Open product video
                </a>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl sm:text-7xl">
              {emoji}
            </div>
          )}

          {activeItem?.type === "image" && zoomVisible && activeSrc && (
            <div
              className="pointer-events-none absolute inset-0 z-20 hidden rounded-[2rem] border border-gold/30 bg-white bg-no-repeat shadow-xl lg:block"
              style={{
                backgroundImage: `url("${activeSrc}")`,
                backgroundSize: `${ZOOM_SCALE * 100}%`,
                backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
              }}
            >
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-carbon/80 px-3 py-1 text-xs font-semibold text-white">
                Move mouse to zoom
              </span>
            </div>
          )}

          {badge && (
            <span className="absolute left-4 top-4 z-30 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-carbon shadow-sm">
              {badge}
            </span>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous media"
                className="absolute left-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white sm:h-10 sm:w-10 md:opacity-0 md:group-hover:opacity-100"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next media"
                className="absolute right-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white sm:h-10 sm:w-10 md:opacity-0 md:group-hover:opacity-100"
              >
                →
              </button>

              <span className="absolute bottom-4 right-4 z-30 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-carbon shadow-sm">
                {active + 1} / {total}
              </span>
            </>
          )}
        </div>

        {renderThumbnails(false)}
      </div>
    </div>
  );
}