import { NextResponse } from "next/server";
import { fetchErpProductPage } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Prices may depend on the visitor's referral cookie; never share this response.
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return NextResponse.json(
      { error: "Provide a valid product offset." },
      { status: 400, headers },
    );
  }

  try {
    return NextResponse.json(await fetchErpProductPage(offset), { headers });
  } catch (error) {
    console.error("Homepage product page could not be loaded:", error);
    return NextResponse.json(
      { error: "Unable to load more products. Please try again." },
      { status: 503, headers },
    );
  }
}
