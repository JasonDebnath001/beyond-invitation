import { NextResponse } from "next/server";
import { fetchErpProductPage } from "@/lib/catalog";
import { fetchItemCategoryProductPage } from "@/lib/catalog-item-category";
import { PRODUCTS_PER_PAGE } from "@/lib/product-page";

export const dynamic = "force-dynamic";

// Prices may depend on the visitor's referral cookie; never share this response.
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const rawOffset = searchParams.get("offset") ?? "0";
  const pricedOnly = searchParams.get("pricedOnly") === "true";
  const collection = searchParams.get("collection");
  const offset = Number(rawOffset);
  if (
    !/^\d+$/.test(rawOffset) ||
    !Number.isSafeInteger(offset) ||
    offset > 2147483647 - PRODUCTS_PER_PAGE
  ) {
    return NextResponse.json(
      { error: "Provide a valid product offset." },
      { status: 400, headers },
    );
  }

  try {
    const page = collection === "wedding-boxes"
      ? await fetchItemCategoryProductPage("Wedding Box", offset)
      : await fetchErpProductPage(offset, pricedOnly);
    return NextResponse.json(page, { headers });
  } catch (error) {
    console.error("Homepage product page could not be loaded:", error);
    return NextResponse.json(
      { error: "Unable to load more products. Please try again." },
      { status: 503, headers },
    );
  }
}
