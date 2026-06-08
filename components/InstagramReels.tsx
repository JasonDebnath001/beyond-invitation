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

type InstagramApiResponse = {
  data?: InstagramReel[];
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
};

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/beyond_invitation/";
const INSTAGRAM_GRAPH_VERSION = "v25.0";

async function getInstagramReels(limit = 14): Promise<InstagramReel[]> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    console.error(
      "Instagram env vars missing: INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN",
    );
    return [];
  }

  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
  ].join(",");

  const url = new URL(
    `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${userId}/media`,
  );

  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(limit * 3));
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const json = (await response.json()) as InstagramApiResponse;

    if (!response.ok || json.error) {
      console.error("Instagram API error:", json.error?.message);
      return [];
    }

    return (json.data || [])
      .filter((item) => {
        return (
          item.media_type === "VIDEO" &&
          Boolean(item.permalink) &&
          Boolean(item.thumbnail_url || item.media_url)
        );
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch Instagram reels:", error);
    return [];
  }
}

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

export default async function InstagramReels() {
  const reels = await getInstagramReels(14);

  if (!reels.length) {
    return null;
  }

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
      </div>
    </section>
  );
}