"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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

function isPrivateFileUrl(src?: string) {
  if (!src) return false;

  const value = src.trim().toLowerCase();

  return (
    value.startsWith("/private/files/") || value.includes("/private/files/")
  );
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

      return embed.toString();
    }

    return src;
  } catch {
    return src;
  }
}

function getVideoSrc(src: string) {
  if (isYoutubeUrl(src)) {
    return toYoutubeEmbedUrl(src);
  }

  if (isVimeoUrl(src)) {
    return toVimeoEmbedUrl(src);
  }

  return src;
}

function isEmbeddableVideo(src: string) {
  return (
    src.includes("youtube.com/embed/") ||
    src.includes("player.vimeo.com/video/")
  );
}

function isDirectVideo(src: string) {
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(src.split("?")[0]);
}

function isVideoLikeUrl(src: string) {
  return isYoutubeUrl(src) || isVimeoUrl(src) || isDirectVideo(src);
}

function isImageLikeUrl(src: string) {
  const value = src.trim();

  if (!value) {
    return false;
  }

  if (isPrivateFileUrl(value)) {
    return false;
  }

  if (isVideoLikeUrl(value)) {
    return false;
  }

  const cleanPath = value.split("?")[0].toLowerCase();

  return (
    /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(cleanPath) ||
    value.startsWith("/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
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

export default function ProductGallery({
  images,
  videos = [],
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const media: GalleryItem[] = useMemo(() => {
    const cleanImages = cleanMediaList(images).filter(isImageLikeUrl).reverse();
    const cleanVideos = cleanMediaList(videos).filter(isVideoLikeUrl);

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

  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({
    x: 50,
    y: 50,
  });
  const [imageSizes, setImageSizes] = useState<Record<number, ImageSize>>({});

  const stageRef = useRef<HTMLDivElement | null>(null);

  const total = media.length;
  const hasMedia = total > 0;
  const activeItem = hasMedia ? media[Math.min(active, total - 1)] : null;

  const activeSrc =
    activeItem?.type === "image"
      ? getImageSrc(activeItem.src)
      : activeItem?.type === "video"
        ? getVideoSrc(activeItem.src)
        : "";

  const go = useCallback(
    (delta: number) => {
      if (total === 0) {
        return;
      }

      setZoomVisible(false);

      setActive((current) => {
        return (current + delta + total) % total;
      });
    },
    [total],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  }

  function markFailed(index: number) {
    setFailed((current) => ({
      ...current,
      [index]: true,
    }));
  }

  function saveImageSize(index: number, image: HTMLImageElement) {
    setImageSizes((current) => ({
      ...current,
      [index]: {
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    }));
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (activeItem?.type !== "image") {
      setZoomVisible(false);
      return;
    }

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

  function renderThumbnails() {
    if (total <= 1) {
      return null;
    }

    return (
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {media.map((item, index) => {
          const isActive = index === active;
          const src =
            item.type === "image"
              ? getImageSrc(item.src)
              : getVideoSrc(item.src);

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
              className={`relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-ivory transition sm:h-[76px] sm:w-[76px] ${
                isActive
                  ? "border-carbon ring-1 ring-carbon"
                  : "border-gold/25 hover:border-gold"
              }`}
            >
              {item.type === "video" ? (
                <span className="flex h-full w-full items-center justify-center bg-carbon text-xl text-white">
                  ▶
                </span>
              ) : failed[index] || !src ? (
                <span className="flex h-full w-full items-center justify-center text-xl">
                  {emoji}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={`${alt} thumbnail ${index + 1}`}
                  onError={() => markFailed(index)}
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
    <section
      className="w-full"
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label="Product media gallery"
    >
      <div
        ref={stageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative aspect-square overflow-hidden rounded-3xl border border-gold/20 bg-ivory shadow-sm outline-none"
      >
        {hasMedia && activeItem ? (
          <>
            {activeItem.type === "image" ? (
              failed[active] || !activeSrc ? (
                <div className="flex h-full w-full items-center justify-center text-6xl">
                  {emoji}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeSrc}
                  alt={alt}
                  onLoad={(event) => {
                    saveImageSize(active, event.currentTarget);
                  }}
                  onError={() => markFailed(active)}
                  className="h-full w-full object-contain p-3"
                />
              )
            ) : isEmbeddableVideo(activeSrc) ? (
              <iframe
                key={activeSrc}
                src={activeSrc}
                title={`${alt} product video`}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : isDirectVideo(activeSrc) ? (
              <video
                key={activeSrc}
                src={activeSrc}
                className="h-full w-full object-contain"
                autoPlay
                muted
                loop
                playsInline
                controls={false}
              />
            ) : (
              <a
                href={activeSrc}
                target="_blank"
                rel="noreferrer"
                className="flex h-full w-full items-center justify-center text-sm font-semibold text-carbon underline"
              >
                Open product video
              </a>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">
            {emoji}
          </div>
        )}

        {activeItem?.type === "image" &&
          zoomVisible &&
          activeSrc &&
          !failed[active] && (
            <div
              className="pointer-events-none absolute inset-0 z-20 hidden bg-white bg-no-repeat md:block"
              style={{
                backgroundImage: `url(${activeSrc})`,
                backgroundSize: `${ZOOM_SCALE * 100}%`,
                backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
              }}
            >
              <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-carbon shadow">
                Move mouse to zoom
              </span>
            </div>
          )}

        {badge && (
          <span className="absolute left-4 top-4 z-30 rounded-full bg-carbon px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
            {badge}
          </span>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous media"
              className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next media"
              className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/30 bg-white/90 text-carbon shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            >
              →
            </button>

            <span className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-carbon shadow">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {renderThumbnails()}
    </section>
  );
}
