import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getRazorpay } from "@/lib/razorpay";
import { resolveCartProducts } from "@/lib/checkout";
import { createDraftSalesOrder } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in before placing an order." },
        { status: 401 },
      );
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unable to read your account details. Please sign in again." },
        { status: 401 },
      );
    }

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      undefined;

    const phone =
      user.primaryPhoneNumber?.phoneNumber ??
      user.phoneNumbers?.[0]?.phoneNumber ??
      undefined;

    const customerName =
      user.fullName ??
      [user.firstName, user.lastName].filter(Boolean).join(" ") ??
      "Website Customer";

    const body = await request.json().catch(() => ({}));

    const { lines, amountPaise, currency } = await resolveCartProducts(
      body?.items ?? [],
    );

    if (lines.length === 0 || amountPaise < 100) {
      return NextResponse.json(
        { error: "Cart is empty or below the minimum amount." },
        { status: 400 },
      );
    }

    // 1) Razorpay order — amount is computed server-side from ERP/cart resolver.
    const rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        source: "beyond-invitation-web",
        clerkUserId: userId,
        customerName,
        customerEmail: email ?? "",
        customerPhone: phone ?? "",
      },
    });

    // 2) Draft ERPNext Sales Order.
    // Buyer details are taken from Clerk, not from the browser request body.
    await createDraftSalesOrder({
      razorpayOrderId: rzpOrder.id,
      items: lines.map((line) => ({
        item_code: line.itemCode,
        qty: line.quantity,
        rate: line.price,
      })),
      buyer: {
        name: customerName,
        email,
        phone,
      },
    });

    return NextResponse.json({
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}