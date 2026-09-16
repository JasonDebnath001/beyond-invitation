import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { confirmWebsiteOrderPayment } from "@/lib/website-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Must verify over the RAW body — do not parse before verifying.
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const raw = await request.text();

  try {
    if (!verifyWebhookSignature(raw, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch (error) {
    console.error("Razorpay webhook verification unavailable:", error);
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
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

      if (typeof orderId !== "string" || typeof paymentId !== "string" ||
        !orderId || !paymentId || (payment?.order_id && payment.order_id !== orderId)) {
        return NextResponse.json({ error: "Missing or inconsistent payment references" }, { status: 400 });
      }
      const order = await confirmWebsiteOrderPayment({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
      });
      if (order.paymentStatus !== "paid") throw new Error("Payment capture not yet confirmed.");
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    // A non-2xx response requests a retry; the database update is idempotent.
    console.error("Webhook website order update failed:", e);
    return NextResponse.json({ error: "Order update failed" }, { status: 500 });
  }
}
