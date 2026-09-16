import { NextResponse, type NextRequest } from "next/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import {
  confirmWebsiteOrderPayment,
  InvalidOrderPaymentError,
} from "@/lib/website-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body ?? {};

    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(
      (value) => typeof value === "string" && value.length > 0,
    )) {
      return NextResponse.json(
        {
          verified: false,
          error: "Missing payment parameters.",
        },
        { status: 400 },
      );
    }

    const ok = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!ok) {
      return NextResponse.json(
        {
          verified: false,
          error: "Signature verification failed.",
        },
        { status: 400 },
      );
    }

    // The signature is authentic. A capture/storage delay must not encourage
    // the customer to pay again; the webhook will reconcile the saved order.
    let websiteOrderId: string | null = null;
    let paymentPending = true;

    try {
      const order = await confirmWebsiteOrderPayment({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });

      websiteOrderId = order.id;
      paymentPending = order.paymentStatus !== "paid";
    } catch (error) {
      if (error instanceof InvalidOrderPaymentError) {
        return NextResponse.json(
          { verified: false, error: "Payment details could not be confirmed. Please contact us with your payment reference." },
          { status: 400 },
        );
      }
      console.error("Website payment confirmation pending; webhook will retry:", error);
    }

    return NextResponse.json({
      verified: true,
      paymentId: razorpay_payment_id,
      websiteOrderId,
      paymentPending,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Verification error.";

    return NextResponse.json(
      {
        verified: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
