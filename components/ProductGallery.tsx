"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ImageOff, X } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import ProductGalleryVideo from "@/components/ProductGalleryVideo";

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

function PhotoLightbox({ item, alt, label, onClose, onError }: {
  item: Extract<GalleryItem, { type: "image" }>;
  alt: string;
  label: string;
  onClose: () => void;
  onError: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backdropPressed = useRef(false);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomUnavailable, setZoomUnavailable] = useState(false);
  const [zoomPosition, setZoomPosition] = useState<ZoomPosition>({ x: 50, y: 50 });
  const src = getImageSrc(item.src);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${padding + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  function outsideDialog(clientX: number, clientY: number) {
    const bounds = dialogRef.current?.getBoundingClientRect();
    return Boolean(bounds && (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom));
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (
      !imageSize || zoomUnavailable ||
      !window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches
    ) {
      setZoomVisible(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / imageSize.width, rect.height / imageSize.height);
    const renderedWidth = imageSize.width * scale;
    const renderedHeight = imageSize.height * scale;
    const left = (rect.width - renderedWidth) / 2;
    const top = (rect.height - renderedHeight) / 2;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < left || x > left + renderedWidth || y < top || y > top + renderedHeight) {
      setZoomVisible(false);
      return;
    }
    // Scale the contained photo around the pointer without zooming blank margins.
    setZoomPosition({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
    setZoomVisible(true);
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onPointerDown={(event) => {
        backdropPressed.current = event.target === event.currentTarget && outsideDialog(event.clientX, event.clientY);
      }}
      onClick={(event) => {
        if (backdropPressed.current && event.target === event.currentTarget && outsideDialog(event.clientX, event.clientY)) onClose();
        backdropPressed.current = false;
      }}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-hidden rounded-2xl border-0 bg-white p-0 text-carbon shadow-2xl backdrop:bg-carbon/70 backdrop:backdrop-blur-sm sm:w-[calc(100%_-_3rem)]"
    >
      <header className="flex items-center justify-between gap-4 border-b border-gold/20 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="truncate text-sm font-semibold sm:text-base">{alt}</h2>
          <p id={`${id}-description`} className="mt-1 text-xs text-ink-light">{label}. Press Escape to close.</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close product media"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/20 transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon">
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </header>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoomVisible(false)}
        className="relative flex h-[min(76dvh,900px)] max-h-[calc(94dvh_-_5rem)] items-center justify-center overflow-hidden bg-ivory"
      >
        <ProductImage
          src={src}
          alt={`${alt} — ${label.toLowerCase()}`}
          fill
          sizes="(min-width: 1200px) 1152px, 100vw"
          quality={90}
          storageTransform
          loading="eager"
          unoptimized={src.startsWith("http://")}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={onError}
          className="object-contain"
        />
        {zoomVisible && (
          <div className="pointer-events-none absolute inset-0">
            <ProductImage
              src={src}
              alt=""
              aria-hidden="true"
              fill
              sizes="200vw"
              quality={90}
              storageTransform
              loading="eager"
              unoptimized={src.startsWith("http://")}
              onError={() => { setZoomUnavailable(true); setZoomVisible(false); }}
              className="object-contain"
              style={{ transform: `scale(${ZOOM_SCALE})`, transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%` }}
            />
          </div>
        )}
        <span className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-carbon/80 px-3 py-1.5 text-xs text-white lg:block">
          Move mouse over photo to zoom
        </span>
      </div>
    </dialog>,
    document.body,
  );
}

export default function ProductGallery({ images, videos = [], emoji, alt, badge }: ProductGalleryProps) {
  const [failedMediaKeys, setFailedMediaKeys] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<{ item: Extract<GalleryItem, { type: "image" }>; label: string } | null>(null);

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

  const media = allMedia.filter((item) => !failedMediaKeys.has(canonicalMediaKey(item.src)));
  const photos = media.filter((item) => item.type === "image");
  const clips = media.filter((item) => item.type === "video");
  const imageSizes = media.length > 1
    ? "(min-width: 1280px) 350px, (min-width: 1024px) calc((100vw - 512px) / 2), (min-width: 768px) calc((100vw - 64px) / 2), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
    : "(min-width: 1280px) 716px, (min-width: 1024px) calc(100vw - 496px), (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)";

  function removeBrokenMedia(item: GalleryItem) {
    const key = canonicalMediaKey(item.src);
    setFailedMediaKeys((current) => new Set(current).add(key));
    setSelected((current) => current && canonicalMediaKey(current.item.src) === key ? null : current);
  }

  return (
    <div className="min-w-0" aria-label="Product photos and videos">
      {media.length === 0 ? (
        <div role="status" className="flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-2xl border border-gold/20 bg-ivory text-ink-light">
          {emoji ? <span className="text-6xl">{emoji}</span> : <ImageOff aria-hidden="true" className="h-10 w-10" strokeWidth={1} />}
          <p className="text-sm">Product photos are currently unavailable.</p>
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label="Product media"
            className={`flex items-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:overflow-visible md:snap-none md:gap-4 ${media.length > 1 ? "md:columns-2" : "md:columns-1"}`}
          >
            {media.map((item, index) => {
              const src = item.type === "image" ? getImageSrc(item.src) : getVideoSrc(item.src);
              const label = item.type === "image"
                ? `Photo ${index + 1} of ${photos.length}`
                : `Video ${index - photos.length + 1} of ${clips.length}`;
              return (
                <div
                  key={canonicalMediaKey(item.src)}
                  className="relative w-full shrink-0 basis-full snap-start snap-always break-inside-avoid overflow-hidden border-0 bg-transparent md:mb-4 md:rounded-2xl md:border md:border-gold/20 md:bg-ivory md:shadow-sm"
                >
                  {item.type === "image" ? (
                    <button
                      type="button"
                      onClick={() => setSelected({ item, label })}
                      aria-label={`Enlarge photo ${index + 1} of ${alt}`}
                      aria-haspopup="dialog"
                      className="block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon"
                    >
                      <ProductImage
                        src={src}
                        alt={`${alt} — photo ${index + 1}`}
                        width={1200}
                        height={1200}
                        sizes={imageSizes}
                        quality={80}
                        storageTransform
                        priority={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        decoding="async"
                        unoptimized={src.startsWith("http://")}
                        onError={() => removeBrokenMedia(item)}
                        className="block h-auto w-full"
                      />
                    </button>
                  ) : (
                    <ProductGalleryVideo
                      src={src}
                      kind={isEmbeddableVideo(src) ? "embed" : canRenderNativeVideo(src) ? "native" : "external"}
                      label={`${alt} — ${label.toLowerCase()}`}
                      paused={Boolean(selected)}
                      onError={() => removeBrokenMedia(item)}
                    />
                  )}
                  {badge && index === 0 && (
                    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-carbon shadow-sm">
                      {badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {media.length > 1 && (
            <p className="mt-2 text-center text-xs text-ink-light md:hidden">Swipe to view more {clips.length > 0 ? "photos and videos" : "photos"}</p>
          )}
        </>
      )}
      {selected && (
        <PhotoLightbox
          key={`${selected.item.type}:${canonicalMediaKey(selected.item.src)}`}
          item={selected.item}
          alt={alt}
          label={selected.label}
          onClose={() => setSelected(null)}
          onError={() => removeBrokenMedia(selected.item)}
        />
      )}
    </div>
  );
}
