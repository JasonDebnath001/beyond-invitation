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

function getImageSrc(img: string) {
  if (!img) return "";

  const value = img.trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (
    value.startsWith("/files/") ||
    value.startsWith("/private/files/")
  ) {
    const erpUrl = process.env.NEXT_PUBLIC_ERPNEXT_URL?.replace(/\/$/, "");

    return erpUrl ? `${erpUrl}${value}` : value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/products/${value}`;
}

function isYoutubeUrl(src: string) {
  return (
    src.includes("youtube.com/embed/") ||
    src.includes("youtube.com/watch") ||
    src.includes("youtu.be/") ||
    src.includes("youtube.com/shorts/")
  );
}

function toYoutubeEmbedUrl(src: string) {
  try {
    const url = new URL(src);
    let id = "";

    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v") || "";
      }

      if (url.pathname.startsWith("/shorts/")) {
        id = url.pathname.split("/")[2] || "";
      }

      if (url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/")[2] || "";
      }
    }

    if (url.hostname === "youtu.be") {
      id = url.pathname.replace("/", "");
    }

    if (!id) {
      return src;
    }

    const embed = new URL(`https://www.youtube.com/embed/${id}`);

    embed.searchParams.set("rel", "0");
    embed.searchParams.set("modestbranding", "1");
    embed.searchParams.set("playsinline", "1");

    return embed.toString();
  } catch {
    return src;
  }
}

function isVimeoUrl(src: string) {
  return src.includes("vimeo.com/");
}

function toVimeoEmbedUrl(src: string) {
  try {
    const url = new URL(src);

    if (url.hostname.includes("player.vimeo.com")) {
      return src;
    }

    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];

      return id ? `https://player.vimeo.com/video/${id}` : src;
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

  if (isVideoLikeUrl(value)) {
    return false;
  }

  const cleanPath = value.split("?")[0].toLowerCase();

  return (
    /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(cleanPath) ||
    value.startsWith("/files/") ||
    value.startsWith("/private/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
}

function cleanMediaList(list: string[]) {
  return Array.from(
    new Set(
      list
        .map((src) => src?.trim())
        .filter((src): src is string => Boolean(src)),
    ),
  );
}

function withAutoplayParams(src: string) {
  try {
    const url = new URL(src);

    url.searchParams.set("autoplay", "1");
    url.searchParams.set("mute", "1");
    url.searchParams.set("muted", "1");
    url.searchParams.set("playsinline", "1");

    return url.toString();
  } catch {
    return (
      src +
      (src.includes("?") ? "&" : "?") +
      "autoplay=1&mute=1&playsinline=1"
    );
  }
}

const ZOOM_SCALE = 2;

export default function ProductGallery({
  images,
  videos = [],
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const media: GalleryItem[] = useMemo(() => {
    /*
     * Reverse the image list.
     *
     * Example:
     * Original: Image 1, Image 2, Image 3
     * Gallery:  Image 3, Image 2, Image 1
     *
     * Because active starts at index 0, Image 3 becomes:
     * 1. The default main image.
     * 2. The first thumbnail.
     */
    const cleanImages = cleanMediaList(images)
      .filter(isImageLikeUrl)
      .reverse();

    const cleanVideos = cleanMediaList(videos).filter((src) =>
      isVideoLikeUrl(src),
    );

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

  const [imageSizes, setImageSizes] = useState<
    Record<number, ImageSize>
  >({});

  const stageRef = useRef<HTMLDivElement | null>(null);

  const total = media.length;
  const hasMedia = total > 0;

  const activeItem = hasMedia
    ? media[Math.min(active, total - 1)]
    : null;

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

  function handleMouseMove(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (activeItem?.type !== "image") {
      setZoomVisible(false);
      return;
    }

    const stage = stageRef.current;
    const imageSize = imageSizes[active];

    if (
      !stage ||
      !imageSize ||
      failed[active] ||
      !activeSrc
    ) {
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
            ? "hidden w-24 shrink-0 flex-col gap-3 lg:flex"
            : "flex gap-3 overflow-x-auto pb-2 lg:hidden"
        }
      >
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
              className={`relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-ivory transition sm:h-[70px] sm:w-[70px] lg:h-24 lg:w-24 ${
                isActive
                  ? "border-carbon ring-1 ring-carbon"
                  : "border-gold/25 hover:border-gold"
              }`}
            >
              {item.type === "video" ? (
                <div className="flex h-full w-full items-center justify-center bg-carbon text-white">
                  ▶
                </div>
              ) : failed[index] || !src ? (
                <div className="flex h-full w-full items-center justify-center text-lg">
                  {emoji}
                </div>
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
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {renderThumbnails(true)}

        <div
          ref={stageRef}
          role="region"
          tabIndex={0}
          aria-label={`${alt} media gallery`}
          onKeyDown={onKeyDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="group relative aspect-square min-w-0 flex-1 overflow-hidden rounded-[2rem] border border-gold/20 bg-ivory shadow-card outline-none"
        >
          {hasMedia && activeItem ? (
            <>
              {activeItem.type === "image" ? (
                failed[active] || !activeSrc ? (
                  <div className="flex h-full w-full items-center justify-center text-7xl">
                    {emoji}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSrc}
                    alt={alt}
                    onLoad={(event) => {
                      saveImageSize(
                        active,
                        event.currentTarget,
                      );
                    }}
                    onError={() => markFailed(active)}
                    className="h-full w-full object-contain p-3"
                  />
                )
              ) : isEmbeddableVideo(activeSrc) ? (
                <iframe
                  src={withAutoplayParams(activeSrc)}
                  title={`${alt} video`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : isDirectVideo(activeSrc) ? (
                <video
                  src={activeSrc}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-carbon text-white">
                  <a
                    href={activeSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-carbon"
                  >
                    Open product video
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-7xl">
              {emoji}
            </div>
          )}

          {activeItem?.type === "image" &&
            zoomVisible &&
            activeSrc &&
            !failed[active] && (
              <div
                className="pointer-events-none absolute inset-0 z-20 hidden rounded-[2rem] bg-no-repeat md:block"
                style={{
                  backgroundImage: `url(${activeSrc})`,
                  backgroundSize: `${ZOOM_SCALE * 100}%`,
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                }}
              >
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-carbon shadow">
                  Move mouse to zoom
                </div>
              </div>
            )}

          {badge && (
            <span className="absolute left-5 top-5 z-30 rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white">
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

              <span className="absolute bottom-4 right-4 z-30 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-carbon shadow">
                {active + 1} / {total}
              </span>
            </>
          )}
        </div>
      </div>

      {renderThumbnails(false)}
    </div>
  );
}