import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getWishlistProducts } from "@/lib/erp-wishlist";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Please sign in to view wishlist.",
        },
        { status: 401 },
      );
    }

    const items = await getWishlistProducts(userId);

    return NextResponse.json({
      items,
      count: items.length,
    });
  } catch (error) {
    console.error("Wishlist products GET error:", error);

    return NextResponse.json(
      {
        error: "Unable to fetch wishlist products.",
      },
      { status: 500 },
    );
  }
}
