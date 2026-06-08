// lib/instagram.ts

export type InstagramReel = {
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

const INSTAGRAM_GRAPH_VERSION = "v25.0";

function isValidInstagramReel(item: InstagramReel) {
  return (
    item.media_type === "VIDEO" &&
    Boolean(item.permalink) &&
    Boolean(item.thumbnail_url || item.media_url)
  );
}

export async function fetchInstagramReels(limit = 8): Promise<InstagramReel[]> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    console.warn(
      "Instagram credentials are missing. Add INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN in production.",
    );
    return [];
  }

  if (!/^\d+$/.test(userId)) {
    console.error(
      "INSTAGRAM_USER_ID must be the numeric Instagram Business Account ID, not the Instagram handle.",
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
  url.searchParams.set("limit", String(limit * 2));
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url.toString(), {
      next: {
        revalidate: 60 * 30,
      },
    });

    const json = (await response.json()) as InstagramApiResponse;

    if (!response.ok || json.error) {
      console.error("Instagram API error:", json.error?.message);
      return [];
    }

    return (json.data || []).filter(isValidInstagramReel).slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch Instagram reels:", error);
    return [];
  }
}