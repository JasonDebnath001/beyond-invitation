import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { fulfillSalesOrder } from "@/lib/erpnext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          verified: false,
          error: "Please sign in before verifying payment.",
        },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
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

    // Authentic payment. Fulfil now; webhook remains the safety net.
    let erpOrder: string | null = null;
    let fulfilmentPending = false;

    try {
      const fulfilled = await fulfillSalesOrder({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      });

      erpOrder = fulfilled.name;
    } catch (error) {
      console.error("Inline fulfilment failed; webhook will retry:", error);
      fulfilmentPending = true;
    }

    return NextResponse.json({
      verified: true,
      paymentId: razorpay_payment_id,
      erpOrder,
      fulfilmentPending,
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