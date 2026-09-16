import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/catalog";
import { MAX_WISHLIST_ITEMS, normalizeWishlistSlugs } from "@/lib/wishlist";

export const dynamic = "force-dynamic";

/** Resolve saved slugs against the current public Supabase catalogue. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.slugs) || body.slugs.length > MAX_WISHLIST_ITEMS ||
      body.slugs.some((slug: unknown) => typeof slug !== "string" || !slug.trim() || slug.length > 200)) {
    return NextResponse.json({ error: "Provide a valid list of product slugs." }, { status: 400 });
  }

  const slugs = normalizeWishlistSlugs(body.slugs);
  if (!slugs.length) return NextResponse.json({ products: [] });

  try {
    const bySlug = new Map((await getCatalogProducts()).map((product) => [product.slug, product]));
    return NextResponse.json({ products: slugs.flatMap((slug) => bySlug.has(slug) ? [bySlug.get(slug)!] : []) });
  } catch (error) {
    console.error("Wishlist product lookup failed:", error);
    return NextResponse.json({ error: "Unable to load saved products. Please try again." }, { status: 503 });
  }
}
