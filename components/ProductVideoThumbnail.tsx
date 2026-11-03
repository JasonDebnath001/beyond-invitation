"use client";

import { useEffect, useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";

interface ProductVideoThumbnailProps {
  src: string;
  kind: "native" | "embed" | "external";
  fallbackSrc?: string;
}

function providerThumbnail(src: string) {
  try {
    const url = new URL(src);
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "youtu.be"
    ) {
      const id =
        url.hostname === "youtu.be"
          ? parts[0]
          : url.searchParams.get("v") || parts.at(-1);
      if (id && /^[\w-]+$/.test(id))
        return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {
    // Local media does not need a provider thumbnail.
  }
  return "";
}

function vimeoOembedUrl(src: string) {
  try {
    const url = new URL(src);
    if (
      !["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)
    )
      return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const id = url.hostname === "player.vimeo.com" ? parts[1] : parts[0];
    if (!id || !/^\d+$/.test(id)) return "";
    const hash =
      url.searchParams.get("h") ||
      (url.hostname !== "player.vimeo.com" ? parts[1] : "");
    const videoUrl = `https://vimeo.com/${id}${hash && /^[\w-]+$/.test(hash) ? `/${hash}` : ""}`;
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}&width=640`;
  } catch {
    return "";
  }
}

export default function ProductVideoThumbnail({
  src,
  kind,
  fallbackSrc,
}: ProductVideoThumbnailProps) {
  const [desktop, setDesktop] = useState(false);
  const [readySource, setReadySource] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const seekTarget = useRef<{ source: string; time: number } | null>(null);
  const [resolvedThumbnail, setResolvedThumbnail] = useState<{
    source: string;
    url: string;
  } | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(
    () => new Set(),
  );
  const thumbnail =
    providerThumbnail(src) ||
    (resolvedThumbnail?.source === src ? resolvedThumbnail.url : "");
  const imageSrc = [thumbnail, fallbackSrc].find(
    (value) => value && !failedImages.has(value),
  );
  const frameReady = readySource === src;

  function revealDecodedFrame(video: HTMLVideoElement) {
    const target = seekTarget.current;
    // loadeddata may describe the blank opening frame, before the seek finishes.
    // Keep the product photo visible until the requested preview is decoded.
    if (
      target?.source !== src ||
      video.seeking ||
      video.readyState < 2 ||
      !video.videoWidth ||
      !video.videoHeight ||
      Math.abs(video.currentTime - target.time) >
        Math.min(0.05, target.time / 2)
    )
      return;
    setReadySource(src);
  }

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setReadySource(null);
    setVideoFailed(false);
    seekTarget.current = null;
  }, [src]);

  useEffect(() => {
    if (kind !== "embed") return;
    const endpoint = vimeoOembedUrl(src);
    if (!endpoint) return;
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { thumbnail_url?: unknown } | null) => {
        if (
          controller.signal.aborted ||
          typeof data?.thumbnail_url !== "string"
        )
          return;
        const url = new URL(data.thumbnail_url);
        if (
          url.protocol === "https:" &&
          (url.hostname === "vimeocdn.com" ||
            url.hostname.endsWith(".vimeocdn.com"))
        ) {
          setResolvedThumbnail({ source: src, url: url.toString() });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [src, kind]);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block overflow-hidden"
    >
      {imageSrc ? (
        <ProductImage
          src={imageSrc}
          alt=""
          fill
          sizes="(min-width: 768px) 80px, 100vw"
          unoptimized
          onError={() =>
            setFailedImages((current) => new Set(current).add(imageSrc))
          }
          className="object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-ink-mid">
          Video
        </span>
      )}
      {kind === "native" && !videoFailed && desktop && (
        <video
          key={src}
          src={src}
          poster={fallbackSrc}
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          preload="auto"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            // Skip the often-blank first frame while staying within short clips.
            const time =
              Number.isFinite(video.duration) && video.duration > 0
                ? Math.min(1, video.duration / 2)
                : 1;
            seekTarget.current = { source: src, time };
            try {
              video.currentTime = time;
            } catch {
              // Non-seekable media keeps the product-photo fallback.
              seekTarget.current = null;
            }
          }}
          onLoadedData={(event) => revealDecodedFrame(event.currentTarget)}
          onSeeked={(event) => revealDecodedFrame(event.currentTarget)}
          onCanPlay={(event) => revealDecodedFrame(event.currentTarget)}
          onPlay={(event) => event.currentTarget.pause()}
          onError={() => setVideoFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover ${frameReady ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
