import { NextResponse } from "next/server";
import { fetchErpProductImages } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// The base lookup shares the catalogue cache and admin invalidation. Avoid a
// separate HTTP cache that could outlive those changes or product visibility.
const headers = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (slug.length > 200 || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return NextResponse.json(
      { error: "Provide a valid product slug." },
      { status: 400, headers },
    );
  }

  try {
    const images = await fetchErpProductImages(slug);
    if (images === null) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404, headers },
      );
    }
    return NextResponse.json({ images }, { headers });
  } catch (error) {
    console.error("Product gallery could not be loaded:", error);
    return NextResponse.json(
      { error: "Unable to load product images. Please try again." },
      { status: 503, headers },
    );
  }
}
