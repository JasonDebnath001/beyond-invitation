"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { ImageOff, Play } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import ProductGalleryVideo from "@/components/ProductGalleryVideo";
import ProductVideoThumbnail from "@/components/ProductVideoThumbnail";

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

function isEmbeddableVideo(src: string) {
  return (
    src.includes("youtube.com/embed/") ||
    src.includes("player.vimeo.com/video/")
  );
}

function isDirectVideo(src: string) {
  return hasVideoExtension(src);
}

function canRenderNativeVideo(src: string) {
  /*
   * A media host can serve an uploaded video through an extensionless /files URL.
   * Once a source is in the dedicated video list, that URL is safe to render
   * with the native video element even when the extension is unavailable.
   */
  return isDirectVideo(src) || src.includes("/files/");
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
  if (value.includes("/storage/v1/object/public/")) return true;

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

function dedupeByCanonicalKey(list: string[]) {
  const seen = new Set<string>();

  return list.filter((src) => {
    const key = canonicalMediaKey(src);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function GalleryPhoto({
  src,
  alt,
  sizes,
  priority,
  active,
  onAspectRatioChange,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority: boolean;
  active: boolean;
  onAspectRatioChange: (ratio: number) => void;
  onError: () => void;
}) {
  const photoRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const aspectRatio = imageSize && imageSize.width > 0 && imageSize.height > 0
    ? imageSize.width / imageSize.height : 1;
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition | null>(null);
  const [zoomUnavailable, setZoomUnavailable] = useState(false);
  const syncImageSize = useCallback((image: HTMLImageElement) => {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    setImageSize((current) => current?.width === width && current.height === height ? current : { width, height });
    onAspectRatioChange(width / height);
  }, [onAspectRatioChange]);

  useEffect(() => {
    // Cached images can finish loading before React attaches onLoad.
    const image = photoRef.current?.querySelector("img");
    if (image?.complete) syncImageSize(image);
  }, [src, active, syncImageSize]);

  useEffect(() => {
    setZoomPosition(null);
  }, [active]);

  useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 768px) and (hover: hover) and (pointer: fine)",
    );
    const resetZoom = () => setZoomPosition(null);
    query.addEventListener("change", resetZoom);
    return () => query.removeEventListener("change", resetZoom);
  }, []);

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (
      !active ||
      !imageSize ||
      zoomUnavailable ||
      !window.matchMedia(
        "(min-width: 768px) and (hover: hover) and (pointer: fine)",
      ).matches
    ) {
      setZoomPosition(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height || !imageSize.width || !imageSize.height)
      return;
    const scale = Math.min(
      rect.width / imageSize.width,
      rect.height / imageSize.height,
    );
    const renderedWidth = imageSize.width * scale;
    const renderedHeight = imageSize.height * scale;
    const left = (rect.width - renderedWidth) / 2;
    const top = (rect.height - renderedHeight) / 2;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Keep letterboxed margins still; zoom only while hovering over the photo.
    if (
      x < left ||
      x > left + renderedWidth ||
      y < top ||
      y > top + renderedHeight
    ) {
      setZoomPosition(null);
      return;
    }
    setZoomPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  }

  return (
    <div
      ref={photoRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setZoomPosition(null)}
      style={{ "--product-media-aspect-ratio": aspectRatio } as CSSProperties}
      className="relative w-full overflow-hidden md:w-[min(100%,calc(var(--product-media-max-height)*var(--product-media-aspect-ratio)))] md:cursor-zoom-in"
    >
      <ProductImage
        src={src}
        alt={alt}
        width={1200}
        height={1200}
        sizes={sizes}
        quality={80}
        storageTransform
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        unoptimized={src.startsWith("http://")}
        onLoad={(event) => syncImageSize(event.currentTarget)}
        onError={onError}
        className="block h-auto w-full md:max-h-[var(--product-media-max-height)] md:object-contain"
      />
      {active && zoomPosition && (
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          <ProductImage
            src={src}
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 1280px) 1600px, 200vw"
            quality={90}
            storageTransform
            loading="eager"
            unoptimized={src.startsWith("http://")}
            onError={() => {
              setZoomUnavailable(true);
              setZoomPosition(null);
            }}
            className="object-contain"
            style={{
              transform: `scale(${ZOOM_SCALE})`,
              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ProductGallery({
  images,
  videos = [],
  emoji,
  alt,
  badge,
}: ProductGalleryProps) {
  const galleryId = useId();
  const galleryRef = useRef<HTMLDivElement>(null);
  const [failedMediaKeys, setFailedMediaKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeMediaKey, setActiveMediaKey] = useState<string | null>(null);
  const [mediaAspectRatios, setMediaAspectRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    let disposed = false;
    const updateHeight = () => {
      if (disposed || !desktop.matches) return;
      // Reserve the real header/breadcrumb height and a small viewport gutter.
      // Document coordinates keep the image size stable while the page scrolls.
      const top = gallery.getBoundingClientRect().top + window.scrollY;
      gallery.style.setProperty(
        "--product-media-max-height",
        `${Math.max(1, window.innerHeight - top - 16)}px`,
      );
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    const observer = typeof ResizeObserver === "undefined"
      ? null : new ResizeObserver(updateHeight);
    observer?.observe(gallery);
    void document.fonts?.ready.then(updateHeight);
    return () => {
      disposed = true;
      window.removeEventListener("resize", updateHeight);
      observer?.disconnect();
    };
  }, []);

  const allMedia: GalleryItem[] = useMemo(() => {
    // Preserve catalogue photo order, with the primary product image first.
    const rawImages = cleanMediaList(images);
    const videosFoundInsideImages = rawImages.filter(isVideoLikeUrl);
    // Dedicated video entries may be extensionless /files URLs. Canonical keys
    // keep a video discovered in both source lists from appearing twice.
    const cleanVideos = dedupeByCanonicalKey(
      cleanMediaList([...videosFoundInsideImages, ...videos]),
    ).filter((src) => Boolean(getVideoSrc(src)));
    const videoKeys = new Set(cleanVideos.map(canonicalMediaKey));
    const cleanImages = rawImages
      .filter((src) => !videoKeys.has(canonicalMediaKey(src)))
      .filter(isImageLikeUrl)
      .filter((src) => Boolean(getImageSrc(src)));
    return [
      ...cleanImages.map((src) => ({ type: "image" as const, src })),
      ...cleanVideos.map((src) => ({ type: "video" as const, src })),
    ];
  }, [images, videos]);

  const media = allMedia.filter(
    (item) => !failedMediaKeys.has(canonicalMediaKey(item.src)),
  );
  const photos = media.filter((item) => item.type === "image");
  const clips = media.filter((item) => item.type === "video");
  const videoPoster = photos[0] ? getImageSrc(photos[0].src) : undefined;
  const activeItem =
    media.find((item) => canonicalMediaKey(item.src) === activeMediaKey) ??
    media[0];
  const activeKey = activeItem ? canonicalMediaKey(activeItem.src) : null;
  const activeAspectRatio = (activeKey ? mediaAspectRatios[activeKey] : undefined)
    ?? (activeItem?.type === "video" && !canRenderNativeVideo(getVideoSrc(activeItem.src)) ? 16 / 9 : 1);
  const imageSizes =
    media.length > 1
      ? "(min-width: 1280px) 680px, (min-width: 1024px) calc(100vw - 544px), (min-width: 768px) calc(100vw - 136px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
      : "(min-width: 1280px) 776px, (min-width: 1024px) calc(100vw - 456px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)";

  function removeBrokenMedia(item: GalleryItem) {
    const key = canonicalMediaKey(item.src);
    setFailedMediaKeys((current) => new Set(current).add(key));
  }

  function rememberAspectRatio(item: GalleryItem, ratio: number) {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    const key = canonicalMediaKey(item.src);
    setMediaAspectRatios((current) => current[key] === ratio ? current : { ...current, [key]: ratio });
  }

  return (
    <div
      ref={galleryRef}
      style={{ "--product-gallery-aspect-ratio": activeAspectRatio } as CSSProperties}
      className={`min-w-0 [--product-media-max-height:calc(100dvh_-_12rem)] lg:w-[calc(var(--product-media-max-height)*var(--product-gallery-aspect-ratio)+var(--product-thumbnail-space))] lg:max-w-full ${media.length > 1 ? "[--product-thumbnail-space:88px] xl:[--product-thumbnail-space:96px]" : "[--product-thumbnail-space:0px]"}`}
      aria-label="Product photos and videos"
    >
      {media.length === 0 ? (
        <div
          role="status"
          className="flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-2xl border border-gold/20 bg-ivory text-ink-light"
        >
          {emoji ? (
            <span className="text-6xl">{emoji}</span>
          ) : (
            <ImageOff
              aria-hidden="true"
              className="h-10 w-10"
              strokeWidth={1}
            />
          )}
          <p className="text-base">Product photos are currently unavailable.</p>
        </div>
      ) : (
        <>
          <div
            className={
              media.length > 1
                ? "md:grid md:grid-cols-[72px_minmax(0,1fr)] md:gap-4 xl:grid-cols-[80px_minmax(0,1fr)]"
                : ""
            }
          >
            {media.length > 1 && (
              <div
                role="group"
                aria-label="Choose product media"
                className="relative hidden min-h-0 md:block"
              >
                <div className="absolute inset-0 flex flex-col gap-3 overflow-y-auto overscroll-y-contain [scrollbar-width:thin]">
                  {media.map((item, index) => {
                    const key = canonicalMediaKey(item.src);
                    const isActive = key === activeKey;
                    const photoNumber = index + 1;
                    const videoNumber = index - photos.length + 1;
                    const src =
                      item.type === "image"
                        ? getImageSrc(item.src)
                        : getVideoSrc(item.src);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveMediaKey(key)}
                        aria-label={`Show ${item.type === "image" ? `photo ${photoNumber}` : `video ${videoNumber}`} of ${alt}`}
                        aria-pressed={isActive}
                        aria-controls={`${galleryId}-media-${index}`}
                        className={`relative aspect-square w-full shrink-0 overflow-hidden border-0 bg-transparent p-0 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon ${isActive ? "opacity-100" : "opacity-60 hover:opacity-100 focus-visible:opacity-100"}`}
                      >
                        {item.type === "image" ? (
                          <ProductImage
                            src={getImageSrc(item.src)}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 80px, 72px"
                            quality={70}
                            storageTransform
                            loading="lazy"
                            unoptimized={getImageSrc(item.src).startsWith(
                              "http://",
                            )}
                            onError={() => removeBrokenMedia(item)}
                            className="object-cover"
                          />
                        ) : (
                          <>
                            <ProductVideoThumbnail
                              src={src}
                              kind={
                                isEmbeddableVideo(src)
                                  ? "embed"
                                  : canRenderNativeVideo(src)
                                    ? "native"
                                    : "external"
                              }
                              fallbackSrc={videoPoster}
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white">
                              <Play className="ml-px h-2.5 w-2.5 fill-current" />
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div
              role="group"
              aria-label="Product media"
              className="flex min-w-0 items-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:overflow-visible md:snap-none"
            >
              {media.map((item, index) => {
                const src =
                  item.type === "image"
                    ? getImageSrc(item.src)
                    : getVideoSrc(item.src);
                const label =
                  item.type === "image"
                    ? `Photo ${index + 1} of ${photos.length}`
                    : `Video ${index - photos.length + 1} of ${clips.length}`;
                return (
                  <div
                    key={canonicalMediaKey(item.src)}
                    id={`${galleryId}-media-${index}`}
                    className={`relative w-full shrink-0 basis-full snap-start snap-always overflow-hidden border-0 bg-transparent ${canonicalMediaKey(item.src) === activeKey ? "md:block" : "md:hidden"}`}
                  >
                    {item.type === "image" ? (
                      <GalleryPhoto
                        src={src}
                        alt={`${alt} — photo ${index + 1}`}
                        sizes={imageSizes}
                        priority={index === 0}
                        active={canonicalMediaKey(item.src) === activeKey}
                        onAspectRatioChange={(ratio) => rememberAspectRatio(item, ratio)}
                        onError={() => removeBrokenMedia(item)}
                      />
                    ) : (
                      <ProductGalleryVideo
                        src={src}
                        kind={
                          isEmbeddableVideo(src)
                            ? "embed"
                            : canRenderNativeVideo(src)
                              ? "native"
                              : "external"
                        }
                        label={`${alt} — ${label.toLowerCase()}`}
                        active={canonicalMediaKey(item.src) === activeKey}
                        poster={videoPoster}
                        onAspectRatioChange={(ratio) => rememberAspectRatio(item, ratio)}
                        onError={() => removeBrokenMedia(item)}
                      />
                    )}
                    {badge && index === 0 && (
                      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold uppercase tracking-[0.06em] text-carbon shadow-sm">
                        {badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {media.length > 1 && (
            <p className="mt-2 text-center text-sm text-ink-mid md:hidden">
              Swipe to view more{" "}
              {clips.length > 0 ? "photos and videos" : "photos"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
