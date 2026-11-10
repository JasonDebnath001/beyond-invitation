import Razorpay from "razorpay";
import crypto from "crypto";

let client: Razorpay | null = null;
let clientKeyId: string | undefined;
let clientSecret: string | undefined;

/** Persist the environment used for this payment; never infer it later from current settings. */
export function getRazorpayPaymentContext(): { mode: "test" | "live"; keyId: string } {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "";
  if (keyId.startsWith("rzp_test_")) return { mode: "test", keyId };
  if (keyId.startsWith("rzp_live_")) return { mode: "live", keyId };
  throw new Error("Configure a valid Razorpay test or live key before accepting orders.");
}

export function getRazorpay(): Razorpay {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay env vars missing: set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  if (!client || clientKeyId !== key_id || clientSecret !== key_secret) {
    client = new Razorpay({ key_id, key_secret });
    clientKeyId = key_id;
    clientSecret = key_secret;
  }
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
