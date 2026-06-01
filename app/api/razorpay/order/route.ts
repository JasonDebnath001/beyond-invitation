import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";
import { resolveCartProducts } from "@/lib/checkout";
import { createDraftSalesOrder, type BuyerInfo } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeTrim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCustomer(input: unknown): BuyerInfo {
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

function validateCustomer(customer: BuyerInfo) {
  if (!customer.name) return "Customer name is required.";
  if (!customer.phone) return "Mobile number is required.";
  if (!customer.email) return "Email address is required.";
  if (!customer.addressLine1) return "Address line 1 is required.";
  if (!customer.city) return "City is required.";
  if (!customer.state) return "State is required.";
  if (!customer.pincode) return "PIN code is required.";
  if (!customer.country) return "Country is required.";

  if (!/^\S+@\S+\.\S+$/.test(customer.email)) {
    return "Valid email address is required.";
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

    const { userId } = await auth().catch(() => ({ userId: null }));

    const { lines, amountPaise, currency } = await resolveCartProducts(
      body?.items ?? [],
    );

    if (lines.length === 0 || amountPaise < 100) {
      return NextResponse.json(
        {
          error: "Cart is empty or below the minimum amount.",
        },
        {
          status: 400,
        },
      );
    }

    const fullAddress = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.pincode,
      customer.country,
    ]
      .filter(Boolean)
      .join(", ");

    const razorpayOrder = (await getRazorpay().orders.create({
      amount: amountPaise,
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        source: "beyond-invitation-web",
        clerkUserId: userId ?? "",
        customerName: customer.name ?? "",
        customerEmail: customer.email ?? "",
        customerPhone: customer.phone ?? "",
        customerAddress: fullAddress,
        customerCity: customer.city ?? "",
        customerState: customer.state ?? "",
        customerPincode: customer.pincode ?? "",
        customerCountry: customer.country ?? "",
        customerNotes: customer.notes ?? "",
      },
    })) as {
      id: string;
      amount: string | number;
      currency: string;
    };

    try {
      await createDraftSalesOrder({
        razorpayOrderId: razorpayOrder.id,
        items: lines.map((line) => ({
          item_code: line.itemCode,
          qty: line.quantity,
          rate: line.price,
        })),
        buyer: customer,
      });
    } catch (createError) {
      console.error("Failed to create ERP draft Sales Order", {
        razorpayOrderId: razorpayOrder.id,
        createError,
      });

      return NextResponse.json(
        {
          error:
            "Payment order was created, but ERPNext Sales Order could not be created. Please retry or contact support.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create payment order.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}