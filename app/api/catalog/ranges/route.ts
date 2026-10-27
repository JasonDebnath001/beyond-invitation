import { NextResponse } from "next/server";
import { COLLECTION_PAGE_SIZE } from "@/lib/catalog-browse-options";
import { getCatalogueRange } from "@/lib/catalogue-ranges";
import { fetchCatalogueRangePage } from "@/lib/catalogue-range-products";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const range = getCatalogueRange(params.get("range"));
  const rawOffset = params.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!range || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 2147483647 - COLLECTION_PAGE_SIZE) {
    return NextResponse.json(
      { error: "Provide a valid catalogue range and offset." },
      { status: 400, headers },
    );
  }

  try {
    return NextResponse.json(await fetchCatalogueRangePage(range.id, offset), { headers });
  } catch (error) {
    console.error("Catalogue range could not be loaded:", error);
    return NextResponse.json(
      { error: "Unable to load wedding cards. Please try again." },
      { status: 503, headers },
    );
  }
}
