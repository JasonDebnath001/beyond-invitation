import { NextResponse, type NextRequest } from "next/server";
import { getRazorpay } from "@/lib/razorpay";
import { CheckoutValidationError, resolveCartProducts } from "@/lib/checkout";
import { quoteCartShipping, ShippingQuoteError } from "@/lib/cart-shipping";
import { isValidIndianPincode } from "@/lib/shipping";
import {
  attachRazorpayOrder,
  createWebsiteOrder,
  type OrderCustomer,
} from "@/lib/website-orders";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getActiveResellerFromCookies } from "@/lib/reseller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeTrim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCustomer(input: unknown): OrderCustomer {
  const customer =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};

  return {
    name: safeTrim(customer.name),
    email: safeTrim(customer.email).toLowerCase(),
    phone: safeTrim(customer.contact || customer.phone),
    addressLine1: safeTrim(customer.addressLine1),
    addressLine2: safeTrim(customer.addressLine2),
    city: safeTrim(customer.city),
    state: safeTrim(customer.state),
    pincode: safeTrim(customer.pincode),
    country: safeTrim(customer.country) || "India",
    notes: safeTrim(customer.notes),
  };
}

function validateCustomer(customer: OrderCustomer) {
  if (!customer.name) return "Customer name is required.";
  if (!customer.phone) return "Mobile number is required.";
  if (!customer.email) return "Email address is required.";
  if (!customer.addressLine1) return "Address line 1 is required.";
  if (!customer.city) return "City is required.";
  if (!customer.state) return "State is required.";
  if (!isValidIndianPincode(customer.pincode))
    return "Enter a valid six-digit Indian PIN code.";
  if (customer.country.toLowerCase() !== "india")
    return "Delivery is currently available within India only.";

  if (!/^\S+@\S+\.\S+$/.test(customer.email)) {
    return "Valid email address is required.";
  }

  if (
    customer.name.length > 200 ||
    customer.email.length > 254 ||
    customer.phone.length > 40
  ) {
    return "Customer contact details are too long.";
  }
  if (
    customer.notes.length > 2000 ||
    [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.pincode,
      customer.country,
    ].some((value) => value.length > 500)
  ) {
    return "Address or order notes are too long.";
  }

  return "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const customer = normalizeCustomer(body?.customer);
    const validationError = validateCustomer(customer);

    if (validationError) {
      return NextResponse.json(
        {
          error: validationError,
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Array.isArray(body?.items) ||
      body.items.length < 1 ||
      body.items.length > 100 ||
      body.items.some((item: unknown) => !item || typeof item !== "object")
    ) {
      return NextResponse.json(
        { error: "Provide between 1 and 100 cart items." },
        { status: 400 },
      );
    }

    if (
      !Number.isSafeInteger(body.expectedAmountPaise) ||
      body.expectedAmountPaise < 100 ||
      !Number.isSafeInteger(body.expectedShippingAmountPaise) ||
      body.expectedShippingAmountPaise < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Please calculate shipping and review your total before paying.",
        },
        { status: 400 },
      );
    }

    const reseller = await getActiveResellerFromCookies();
    const products = await resolveCartProducts(body.items, reseller);
    // Recheck with Shiprocket before taking any payment. Never accept a fee,
    // product weight, courier or total supplied by the browser as authoritative.
    const shipping = await quoteCartShipping(products, customer.pincode, {
      refresh: true,
    });
    if (
      body.expectedAmountPaise !== shipping.totalPaise ||
      body.expectedShippingAmountPaise !== shipping.amountPaise
    ) {
      return NextResponse.json(
        {
          error:
            "Your order total has changed. Please review the updated shipping fee and total, then pay again.",
          code: "QUOTE_CHANGED",
          quote: shipping,
        },
        { status: 409 },
      );
    }
    const cart = { ...products, amountPaise: shipping.totalPaise, shipping };
    const { lines, amountPaise, currency } = cart;

    if (
      lines.length === 0 ||
      !Number.isSafeInteger(amountPaise) ||
      amountPaise < 100 ||
      amountPaise > 2147483647
    ) {
      return NextResponse.json(
        {
          error: "Cart total is outside the supported payment amount.",
        },
        {
          status: 400,
        },
      );
    }

    const razorpay = getRazorpay();
    let websiteOrderId: string;
    try {
      const auth = await getSupabaseAuthServerClient();
      const {
        data: { user },
      } = await auth.auth.getUser();
      websiteOrderId = await createWebsiteOrder({
        customer,
        cart,
        // Verified Auth identity only; never trust an email or a supplied user_id.
        userId: user?.id ?? null,
        resellerCode: reseller?.code,
      });
    } catch (error) {
      console.error("Website order could not be saved before checkout:", error);
      return NextResponse.json(
        {
          error: "Checkout is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }

    const razorpayOrder = (await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt: websiteOrderId,
      notes: {
        source: "beyond-invitation-web",
        websiteOrderId,
      },
    })) as {
      id: string;
      amount: string | number;
      currency: string;
    };

    try {
      if (
        Number(razorpayOrder.amount) !== amountPaise ||
        razorpayOrder.currency !== currency
      ) {
        throw new Error(
          "Razorpay order amount or currency does not match the saved cart.",
        );
      }
      await attachRazorpayOrder(websiteOrderId, razorpayOrder.id);
    } catch (createError) {
      console.error("Failed to link website order to Razorpay", {
        websiteOrderId,
        razorpayOrderId: razorpayOrder.id,
        createError,
      });

      return NextResponse.json(
        {
          error:
            "Checkout could not be started. No payment has been taken. Please try again later.",
        },
        {
          status: 503,
        },
      );
    }

    return NextResponse.json({
      websiteOrderId,
      orderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      shipping,
    });
  } catch (err) {
    if (err instanceof ShippingQuoteError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    if (err instanceof CheckoutValidationError) {
      return NextResponse.json(
        { error: err.message, code: "INVALID_CART" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Checkout is temporarily unavailable. Please try again later.",
      },
      {
        status: 500,
      },
    );
  }
}
