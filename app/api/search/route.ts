import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/products";

/*
 * Search API — GET /api/search?q=...
 * Used by the navbar SearchBar for live results as the user types.
 * Reads the same cached public catalogue as the search-results page.
 */
export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchProducts(query);
    return NextResponse.json({ results });
}