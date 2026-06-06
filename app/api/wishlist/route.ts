import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  addProductToWishlist,
  getWishlistRecords,
  removeProductFromWishlist,
} from "@/lib/erp-wishlist";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

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

    const records = await getWishlistRecords(userId);

    return NextResponse.json({
      items: records,
      count: records.length,
    });
  } catch (error) {
    console.error("Wishlist GET error:", error);

    return NextResponse.json(
      {
        error: "Unable to fetch wishlist.",
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Please sign in to add wishlist.",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const productSlug = String(body.productSlug || "").trim();

    if (!productSlug) {
      return NextResponse.json(
        {
          error: "Product slug is required.",
        },
        { status: 400 },
      );
    }

    const user = await currentUser();

    const userEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      "";

    const result = await addProductToWishlist({
      clerkUserId: userId,
      userEmail,
      productSlug,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Wishlist POST error:", error);

    return NextResponse.json(
      {
        error: "Unable to add item to wishlist.",
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Please sign in to remove wishlist.",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const productSlug = String(body.productSlug || "").trim();

    if (!productSlug) {
      return NextResponse.json(
        {
          error: "Product slug is required.",
        },
        { status: 400 },
      );
    }

    const result = await removeProductFromWishlist({
      clerkUserId: userId,
      productSlug,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Wishlist DELETE error:", error);

    return NextResponse.json(
      {
        error: "Unable to remove item from wishlist.",
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}