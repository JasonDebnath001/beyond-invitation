import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { fulfillSalesOrder } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Must verify over the RAW body — do not parse before verifying.
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const raw = await request.text();

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  try {
    const type = event?.event;
    if (type === "order.paid" || type === "payment.captured") {
      const payment = event?.payload?.payment?.entity;
      const orderId =
        event?.payload?.order?.entity?.id ?? payment?.order_id ?? null;
      const paymentId = payment?.id ?? null;

      if (orderId && paymentId) {
        await fulfillSalesOrder({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    // Non-2xx makes Razorpay retry later (e.g. if the draft SO isn't written
    // yet). fulfillSalesOrder is idempotent, so retries are safe.
    console.error("Webhook fulfilment error:", e);
    return NextResponse.json({ error: "fulfilment failed" }, { status: 500 });
  }
}