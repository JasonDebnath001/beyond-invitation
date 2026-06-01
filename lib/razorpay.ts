import Razorpay from "razorpay";
import crypto from "crypto";

let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay env vars missing: set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  if (!client) client = new Razorpay({ key_id, key_secret });
  return client;
}

function timingSafeEqualHex(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checkout signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET missing.");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/** Webhook signature: HMAC_SHA256(rawBody, webhook_secret) vs x-razorpay-signature. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET missing.");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}