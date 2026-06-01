import { NextResponse, type NextRequest } from "next/server";
import { getRazorpay } from "@/lib/razorpay";
import { resolveCartProducts } from "@/lib/checkout";
import { createDraftSalesOrder } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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

    // 1) Razorpay order — amount computed authoritatively from ERP above.
    const rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: { source: "beyond-invitation-web" },
    });

    // 2) Draft Sales Order = our DB-free record of what was ordered, so the
    //    webhook can fulfil even if the browser never calls /verify. The buyer
    //    (from Clerk, sent by the client) is resolved to an ERP Customer.
    const buyer = body?.customer ?? {};
    await createDraftSalesOrder({
      razorpayOrderId: rzpOrder.id,
      items: lines.map((l) => ({
        item_code: l.itemCode,
        qty: l.quantity,
        rate: l.price,
      })),
      buyer: {
        name: buyer.name,
        email: buyer.email,
        phone: buyer.contact,
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