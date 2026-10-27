"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface ProductGalleryVideoProps {
  src: string;
  kind: "native" | "embed" | "external";
  label: string;
  paused: boolean;
  onError: () => void;
}

const FIRST_FRAME_TIME = 0.001;

function showFirstFrame(video: HTMLVideoElement) {
  // A tiny seek asks the browser to decode the opening frame without playing.
  // Keeping this as a video preview also works for hosts without canvas CORS.
  if (video.readyState < 1) return;
  try {
    video.currentTime = Number.isFinite(video.duration)
      ? Math.min(FIRST_FRAME_TIME, video.duration / 2)
      : FIRST_FRAME_TIME;
  } catch {
    // Non-seekable streams can still display their initially decoded frame.
  }
}

function embedSource(src: string, autoplay: boolean) {
  const url = new URL(src);
  url.searchParams.set("autoplay", autoplay ? "1" : "0");
  url.searchParams.set("background", "0");
  url.searchParams.set("mute", "1");
  url.searchParams.set("muted", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("controls", "0");
  url.searchParams.set("disablekb", "1");
  url.searchParams.set("fs", "0");
  return url.toString();
}

export default function ProductGalleryVideo({ src, kind, label, paused, onError }: ProductGalleryVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [intent, setIntent] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const playAllowedRef = useRef(false);
  const shouldPlay = onScreen && pageVisible && !paused &&
    (intent === "play" || (intent === "auto" && mobile && visible));

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
    const observer = new IntersectionObserver(([entry]) => {
      // Check horizontal slide visibility separately: a portrait video can be
      // taller than the screen and never reach a large total-area threshold.
      const bounds = entry.boundingClientRect;
      const intersection = entry.intersectionRect;
      setOnScreen(entry.isIntersecting && intersection.width > 0 && intersection.height > 0);
      setVisible(entry.isIntersecting && bounds.width > 0 &&
        intersection.width >= bounds.width * 0.75 &&
        intersection.height >= Math.min(bounds.height, window.innerHeight) * 0.4);
    }, { threshold: Array.from({ length: 21 }, (_, index) => index / 20) });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    playAllowedRef.current = shouldPlay;
    if (shouldPlay) {
      // If autoplay is blocked, the play button retries with a user gesture.
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
    return () => {
      playAllowedRef.current = false;
      video.pause();
    };
  }, [shouldPlay, src]);

  function togglePlayback() {
    if (kind === "embed") {
      setIntent(shouldPlay ? "pause" : "play");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setIntent("play");
      // Update immediately: a user gesture can start playback before React
      // commits the new intent, including a desktop's first manual play.
      playAllowedRef.current = !paused && !document.hidden;
      void video.play().catch(() => {});
    } else {
      setIntent("pause");
      playAllowedRef.current = false;
      video.pause();
    }
  }

  const isPlaying = kind === "embed" ? shouldPlay : playing;

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      {kind === "native" ? (
        <video
          ref={videoRef}
          src={src.includes("#") ? src : `${src}#t=${FIRST_FRAME_TIME}`}
          aria-label={label}
          muted
          playsInline
          loop
          preload="metadata"
          onLoadedMetadata={(event) => {
            if (event.currentTarget.paused) showFirstFrame(event.currentTarget);
          }}
          onPlay={(event) => {
            if (!playAllowedRef.current || document.hidden || paused) event.currentTarget.pause();
            else setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onError={onError}
          className="block h-auto w-full object-contain"
        />
      ) : kind === "embed" ? (
        <iframe
          // Unload an offscreen player so it cannot continue playing audio.
          key={shouldPlay ? "playing" : "preview"}
          src={embedSource(src, shouldPlay)}
          title={label}
          loading="lazy"
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          className="pointer-events-none block aspect-video w-full border-0"
        />
      ) : (
        <a href={src} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center bg-ivory p-5 text-center font-semibold text-carbon underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon">Open product video</a>
      )}
      {kind !== "external" && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={`${isPlaying ? "Pause" : "Play"} ${label}`}
          className="absolute inset-0 flex w-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
        >
          {!isPlaying && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 shadow-sm">
              <Play aria-hidden="true" className="ml-1 h-6 w-6 fill-current" />
            </span>
          )}
        </button>
      )}
    </div>
  );
}
