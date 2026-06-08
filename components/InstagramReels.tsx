"use client";

import Link from "next/link";

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/beyond_invitation/";

const reels = [
  {
    id: "reel-1",
    title: "Wedding Cards",
    description: "Premium invitation designs, textures, foiling, and layouts.",
  },
  {
    id: "reel-2",
    title: "Shagun Envelopes",
    description: "Elegant envelopes for weddings, gifting, and occasions.",
  },
  {
    id: "reel-3",
    title: "Rakhi Packaging",
    description: "Rakhi boxes, cards, tags, and festive packaging ideas.",
  },
  {
    id: "reel-4",
    title: "Behind The Scenes",
    description: "A closer look at printing, packing, and showroom moments.",
  },
];

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

function PlayIcon() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-carbon shadow-lg transition-transform duration-300 group-hover:scale-110">
      <svg
        className="ml-0.5 h-5 w-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

export default function InstagramReels() {
  return (
    <section
      id="instagram-reels"
      className="relative z-10 block bg-white py-16 sm:py-20"
    >
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white">
  INSTAGRAM SECTION LOADED
</div>
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {reels.map((item) => (
            <Link
              key={item.id}
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[9/14] overflow-hidden border border-neutral-200 bg-paper p-4 transition-colors hover:border-carbon"
            >
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <InstagramIcon className="h-5 w-5 text-carbon" />

                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Reel
                  </span>
                </div>

                <div>
                  <div className="mb-4 flex justify-center">
                    <PlayIcon />
                  </div>

                  <h3 className="font-serif text-xl text-carbon">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-neutral-600">
                    {item.description}
                  </p>
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-carbon">
                  Open Instagram →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}