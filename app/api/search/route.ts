import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/products";

/*
 * Search API — GET /api/search?q=...
 * Used by the navbar SearchBar for live results as the user types.
 * Goes through the same searchProducts() data layer, so when ERPNext is
 * connected, this endpoint keeps working unchanged.
 */
export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await searchProducts(query);
    return NextResponse.json({ results });
}