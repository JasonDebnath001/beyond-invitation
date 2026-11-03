"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ProductVideoThumbnail from "@/components/ProductVideoThumbnail";

interface ProductGalleryVideoProps {
  src: string;
  kind: "native" | "embed" | "external";
  label: string;
  active: boolean;
  poster?: string;
  onAspectRatioChange?: (ratio: number) => void;
  onError: () => void;
}

const FIRST_FRAME_TIME = 0.001;

function showFirstFrame(video: HTMLVideoElement) {
  if (video.readyState < 1) return;
  try {
    video.currentTime = Number.isFinite(video.duration)
      ? Math.min(FIRST_FRAME_TIME, video.duration / 2)
      : FIRST_FRAME_TIME;
  } catch {
    // Non-seekable streams can still display their initially decoded frame.
  }
}

function embedSource(src: string) {
  const url = new URL(src);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("mute", "1");
  url.searchParams.set("muted", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("controls", "0");
  url.searchParams.set("disablekb", "1");
  url.searchParams.set("fs", "0");
  url.searchParams.set("loop", "1");
  if (url.hostname === "player.vimeo.com") {
    url.searchParams.set("background", "1");
    url.searchParams.set("title", "0");
    url.searchParams.set("byline", "0");
    url.searchParams.set("portrait", "0");
  } else {
    url.searchParams.set("rel", "0");
    const id = url.pathname.split("/").filter(Boolean).at(-1);
    if (id) url.searchParams.set("playlist", id);
  }
  return url.toString();
}

export default function ProductGalleryVideo({
  src,
  kind,
  label,
  active,
  poster,
  onAspectRatioChange,
  onError,
}: ProductGalleryVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [videoSize, setVideoSize] = useState<{ source: string; width: number; height: number } | null>(null);
  const aspectRatio = kind === "native"
    ? videoSize?.source === src ? videoSize.width / videoSize.height : 1
    : 16 / 9;
  const playAllowedRef = useRef(false);
  // Desktop follows the selected thumbnail; mobile follows the swiped slide.
  const shouldPlay = onScreen && pageVisible && (mobile ? visible : active);
  const syncVideoSize = useCallback((video: HTMLVideoElement) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width <= 0 || height <= 0) return;
    setVideoSize((current) => current?.source === src && current.width === width && current.height === height
      ? current : { source: src, width, height });
    onAspectRatioChange?.(width / height);
  }, [src, onAspectRatioChange]);

  useEffect(() => {
    // Preloaded metadata may be ready before hydration or thumbnail selection.
    const video = videoRef.current;
    if (video && video.readyState >= 1) syncVideoSize(video);
  }, [src, active, syncVideoSize]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setMobile(query.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMobile();
    updateVisibility();
    query.addEventListener("change", updateMobile);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      query.removeEventListener("change", updateMobile);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // A portrait video can be taller than the screen. Check horizontal slide
        // visibility separately so a neighboring mobile slide cannot autoplay.
        const bounds = entry.boundingClientRect;
        const intersection = entry.intersectionRect;
        setOnScreen(
          entry.isIntersecting &&
            intersection.width > 0 &&
            intersection.height > 0,
        );
        setVisible(
          entry.isIntersecting &&
            bounds.width > 0 &&
            intersection.width >= bounds.width * 0.75 &&
            intersection.height >=
              Math.min(bounds.height, window.innerHeight) * 0.4,
        );
      },
      { threshold: Array.from({ length: 21 }, (_, index) => index / 20) },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    playAllowedRef.current = shouldPlay;
    if (shouldPlay) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
    return () => {
      playAllowedRef.current = false;
      video.pause();
    };
  }, [shouldPlay, src]);

  return (
    <div
      ref={containerRef}
      style={{ "--product-media-aspect-ratio": aspectRatio } as CSSProperties}
      className="relative w-full md:w-[min(100%,calc(var(--product-media-max-height)*var(--product-media-aspect-ratio)))]"
    >
      {kind === "native" ? (
        <video
          ref={videoRef}
          src={src.includes("#") ? src : `${src}#t=${FIRST_FRAME_TIME}`}
          poster={poster}
          aria-label={label}
          autoPlay={shouldPlay}
          muted
          playsInline
          loop
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            syncVideoSize(video);
            if (!playAllowedRef.current) showFirstFrame(video);
          }}
          onCanPlay={(event) => {
            syncVideoSize(event.currentTarget);
            if (playAllowedRef.current && !document.hidden)
              void event.currentTarget.play().catch(() => {});
          }}
          onPlay={(event) => {
            if (!playAllowedRef.current || document.hidden)
              event.currentTarget.pause();
          }}
          onError={onError}
          className="pointer-events-none block h-auto w-full object-contain md:max-h-[var(--product-media-max-height)]"
        />
      ) : kind === "embed" && shouldPlay ? (
        <iframe
          src={embedSource(src)}
          title={label}
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          className="pointer-events-none block aspect-video w-full border-0"
        />
      ) : (
        <div
          role="img"
          aria-label={label}
          className="relative aspect-video w-full"
        >
          <ProductVideoThumbnail src={src} kind={kind} fallbackSrc={poster} />
        </div>
      )}
    </div>
  );
}
