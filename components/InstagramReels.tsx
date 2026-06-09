"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type InstagramReel = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp?: string;
};

type InstagramReelsApiResponse = {
  reels: InstagramReel[];
  error?: string | null;
};

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/beyond_invitation/";

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export default function InstagramReels() {
  const [reels, setReels] = useState<InstagramReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReels() {
      try {
        const response = await fetch("/api/instagram-reels", {
          cache: "no-store",
        });

        const data = (await response.json()) as InstagramReelsApiResponse;

        if (cancelled) {
          return;
        }

        setReels(data.reels || []);
        setError(data.error || null);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load Instagram reels.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReels();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="instagram-reels"
      className="relative z-10 block bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
              Instagram Reels
            </p>

            <h2 className="mt-3 font-serif text-3xl text-carbon sm:text-4xl">
              See Our Cards in Real Moments
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
              Watch our latest wedding card designs, packaging details, and
              behind-the-scenes moments from Beyond Invitation.
            </p>
          </div>

          <Link
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 border border-carbon px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-carbon transition-colors hover:bg-carbon hover:text-white"
          >
            <InstagramIcon className="h-4 w-4" />
            Follow on Instagram
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 14 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[9/14] animate-pulse bg-neutral-100"
              />
            ))}
          </div>
        ) : reels.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {reels.map((reel) => {
              const imageSrc = reel.thumbnail_url || reel.media_url;

              if (!imageSrc) {
                return null;
              }

              return (
                <Link
                  key={reel.id}
                  href={reel.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Instagram reel"
                  className="group relative aspect-[9/14] overflow-hidden bg-neutral-100"
                >
                  <img
                    src={imageSrc}
                    alt={reel.caption || "Instagram reel from Beyond Invitation"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <InstagramIcon className="h-8 w-8 text-white" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="border border-neutral-200 bg-paper px-5 py-6 text-sm text-neutral-600">
            <p>
              Instagram reels could not be loaded right now. Please check the
              deployment logs or open{" "}
              <code className="text-carbon">/api/instagram-reels</code> on the
              live site.
            </p>

            {error && (
              <p className="mt-2 text-xs text-neutral-500">
                Error: {error}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}