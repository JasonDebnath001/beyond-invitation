import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type InstagramRefreshResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "INSTAGRAM_ACCESS_TOKEN is missing" },
      { status: 200 },
    );
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = (await response.json()) as InstagramRefreshResponse;

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          error: data.error?.message || "Failed to refresh Instagram token",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "Instagram token refreshed. Copy the returned access_token into Vercel env.",
        access_token: data.access_token,
        expires_in: data.expires_in,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh Instagram token",
      },
      { status: 200 },
    );
  }
}