import { NextResponse } from "next/server";
import { fetchCatalogProductPage, fetchWeddingProductPage } from "@/lib/catalog-browse";
import { CATALOG_PRICES, CATALOG_SORTS, COLLECTION_PAGE_SIZE, type CatalogBrowseOptions } from "@/lib/catalog-browse-options";
import { CARD_TYPES, PRICE_BUCKETS, WEDDING_SORTS, parseWeddingFilters, type WeddingCollectionType } from "@/lib/wedding-cards";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const categories = ["wedding", "housewarming", "thread-ceremony", "naming-ceremony", "birthday", "baby-shower", "luxe"];

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const rawOffset = q.get("offset") ?? "0";
  const offset = Number(rawOffset);
  const mode = q.get("mode") ?? "catalog";
  const invalid = () => NextResponse.json({ error: "Provide valid catalogue filters and offset." }, { status: 400, headers });
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset > 2147483647 - COLLECTION_PAGE_SIZE || !["catalog", "wedding"].includes(mode)) return invalid();
  const price = q.get("price"), sort = q.get("sort");
  if (mode === "wedding") {
    const collectionType = q.get("collectionType");
    const type = q.get("type");
    if ((collectionType && !["boxes", ...CARD_TYPES.map((t) => t.value)].includes(collectionType)) ||
      (type && !["all", ...CARD_TYPES.map((t) => t.value)].includes(type)) ||
      (price && !["any", ...PRICE_BUCKETS.map((p) => p.value)].includes(price)) ||
      (sort && !WEDDING_SORTS.some((s) => s.value === sort))) return invalid();
    try {
      return NextResponse.json(await fetchWeddingProductPage({ collectionType: (collectionType || undefined) as WeddingCollectionType | undefined, filters: parseWeddingFilters(q), offset }), { headers });
    } catch (error) {
      console.error("Wedding catalogue page failed:", error);
    }
  } else {
    const category = q.get("category");
    const subjects = q.get("subjects")?.split(",");
    if ((category && !categories.includes(category)) || (subjects && (subjects.length > 8 || subjects.some((s) => !s.trim() || s.length > 100))) ||
      (price && !CATALOG_PRICES.includes(price as CatalogBrowseOptions["price"] & string)) ||
      (sort && !CATALOG_SORTS.includes(sort as CatalogBrowseOptions["sort"] & string))) return invalid();
    try {
      return NextResponse.json(await fetchCatalogProductPage({ offset, category: (category || undefined) as CatalogBrowseOptions["category"], subjects, price: (price || undefined) as CatalogBrowseOptions["price"], sort: (sort || undefined) as CatalogBrowseOptions["sort"] }), { headers });
    } catch (error) {
      console.error("Catalogue page failed:", error);
    }
  }
  return NextResponse.json({ error: "Unable to load products. Please try again." }, { status: 503, headers });
}
