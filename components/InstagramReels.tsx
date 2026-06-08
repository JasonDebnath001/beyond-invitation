// components/InstagramReels.tsx

import Image from "next/image";
import Link from "next/link";
import { fetchInstagramReels } from "@/lib/instagram";

type InstagramReelsProps = {
  limit?: number;
};

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export default async function InstagramReels({
  limit = 14,
}: InstagramReelsProps) {
  const reels = await fetchInstagramReels(limit);

  if (!reels.length) {
    return null;
  }

  return (
    <section className="bg-[#fdf8f3] py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-[#b76e79]">
              <InstagramIcon className="h-4 w-4" />
              Instagram Reels
            </p>

            <h2 className="font-serif text-3xl font-bold text-[#3b241f] sm:text-4xl">
              See Our Cards in Real Moments
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f5b53] sm:text-base">
              Watch our latest wedding card designs, packaging details, and
              behind-the-scenes moments from Beyond Invitation.
            </p>
          </div>

          <Link
            href="https://www.instagram.com/beyond_invitationofficial/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[#b76e79]/30 px-5 py-2.5 text-sm font-semibold text-[#8f4d57] transition hover:bg-[#b76e79] hover:text-white"
          >
            Follow on Instagram
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
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
                className="group relative overflow-hidden bg-[#ead8cd] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden">
                  <Image
                    src={imageSrc}
                    alt={reel.caption || "Beyond Invitation Instagram Reel"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 14vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-black/0 transition duration-300 group-hover:bg-black/45" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                    <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#3b241f] shadow-lg">
                      <InstagramIcon className="h-4 w-4 text-[#b76e79]" />
                      Instagram
                    </div>
                  </div>

                  {reel.caption && (
                    <p className="absolute bottom-3 left-3 right-3 line-clamp-2 translate-y-2 text-xs font-medium leading-5 text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      {reel.caption}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}