import { NextResponse, type NextRequest } from "next/server";
import {
  CheckoutValidationError,
  parseCheckoutItems,
  resolveCartProducts,
} from "@/lib/checkout";
import { quoteCartShipping, ShippingQuoteError } from "@/lib/cart-shipping";
import { getActiveResellerFromCookies } from "@/lib/reseller";
import { isValidIndianPincode } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length")) > 32_768)
      return json({ error: "The cart request is too large." }, 413);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return json({ error: "Please check shipping from this website." }, 403);
    const body = await request.json().catch(() => null);
    const pincode =
      typeof body?.pincode === "string" ? body.pincode.trim() : "";
    if (!isValidIndianPincode(pincode))
      return json(
        {
          error: "Enter a valid six-digit Indian pincode.",
          code: "INVALID_PINCODE",
        },
        400,
      );
    const items = parseCheckoutItems(body?.items);
    const reseller = await getActiveResellerFromCookies();
    const cart = await resolveCartProducts(items, reseller);
    return json({ quote: await quoteCartShipping(cart, pincode) });
  } catch (error) {
    if (error instanceof ShippingQuoteError)
      return json({ error: error.message, code: error.code }, error.status);
    if (error instanceof CheckoutValidationError)
      return json({ error: error.message, code: "INVALID_CART" }, 400);
    return json(
      {
        error:
          "Shipping rates are temporarily unavailable. Please try again shortly.",
        code: "SHIPPING_UNAVAILABLE",
      },
      503,
    );
  }
}
