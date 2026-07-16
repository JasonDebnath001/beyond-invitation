import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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

const INSTAGRAM_GRAPH_VERSION = "v25.0";

export async function GET() {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    return NextResponse.json(
      {
        reels: [],
        error:
          "Instagram credentials missing. Check INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN in Vercel production env.",
      },
      { status: 200 },
    );
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
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me/media`,
  );

  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const json = (await response.json()) as InstagramApiResponse;

    if (!response.ok || json.error) {
      return NextResponse.json(
        {
          reels: [],
          error: json.error?.message || "Instagram API request failed.",
        },
        { status: 200 },
      );
    }

    const reels = (json.data || [])
      .filter((item) => {
        return (
          item.media_type === "VIDEO" &&
          Boolean(item.permalink) &&
          Boolean(item.thumbnail_url || item.media_url)
        );
      })
      .slice(0, 14);

    return NextResponse.json(
      {
        reels,
        error: null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        reels: [],
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Instagram reels.",
      },
      { status: 200 },
    );
  }
}