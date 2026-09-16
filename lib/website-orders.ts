import "server-only";

import type { ResolvedCart } from "@/lib/checkout";
import { getRazorpay } from "@/lib/razorpay";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  notes: string;
}

type StoredOrder = {
  id: string;
  amount_paise: number;
  currency: string;
};

export class InvalidOrderPaymentError extends Error {}

function storageError(error: { code?: string } | null): Error {
  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202") {
    return new Error(
      "Website order storage is not installed. Apply supabase/migrations/20260916_website_orders.sql in the Supabase SQL Editor.",
    );
  }
  return new Error(`Website order storage failed (${error?.code || "no row returned"}).`);
}

/** Persist the complete snapshot before creating/exposing a Razorpay order. */
export async function createWebsiteOrder(args: {
  customer: OrderCustomer;
  cart: ResolvedCart;
  userId: string | null;
  resellerCode?: string;
}): Promise<string> {
  const { customer, cart } = args;
  const { data, error } = await getSupabaseAdminClient()
    .from("website_orders")
    .insert({
      user_id: args.userId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      shipping_address: {
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        country: customer.country,
      },
      notes: customer.notes,
      items: cart.lines,
      amount_paise: cart.amountPaise,
      currency: cart.currency,
      reseller_code: args.resellerCode ?? null,
      commission_paise: Math.round(cart.commission * 100),
    })
    .select("id")
    .single();
  if (error || !data) throw storageError(error);
  return data.id;
}

export async function attachRazorpayOrder(websiteOrderId: string, razorpayOrderId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("website_orders")
    .update({ razorpay_order_id: razorpayOrderId })
    .eq("id", websiteOrderId)
    .eq("payment_status", "pending")
    .is("razorpay_order_id", null)
    .select("id")
    .single();
  if (error || !data) throw storageError(error);
}

/** Called only after checkout HMAC or webhook signature verification. */
export async function confirmWebsiteOrderPayment(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<{ id: string; paymentStatus: "pending" | "paid" }> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("website_orders")
    .select("id, amount_paise, currency")
    .eq("razorpay_order_id", args.razorpayOrderId)
    .single();
  if (error || !data) throw storageError(error);
  const order = data as StoredOrder;

  // A valid checkout signature alone does not prove capture or the amount paid.
  const payment = await getRazorpay().payments.fetch(args.razorpayPaymentId);
  if (
    payment.id !== args.razorpayPaymentId ||
    payment.order_id !== args.razorpayOrderId ||
    Number(payment.amount) !== order.amount_paise ||
    payment.currency !== order.currency ||
    !["authorized", "captured"].includes(payment.status)
  ) {
    throw new InvalidOrderPaymentError("Payment does not match the website order.");
  }

  if (payment.status === "authorized") {
    return { id: order.id, paymentStatus: "pending" };
  }

  // Row locking in the database makes browser/webhook retries safe, including
  // simultaneous deliveries. It also rechecks the amount and payment identity.
  const result = await db.rpc("mark_website_order_paid", {
    p_razorpay_order_id: args.razorpayOrderId,
    p_razorpay_payment_id: args.razorpayPaymentId,
    p_amount_paise: Number(payment.amount),
    p_currency: payment.currency,
  });
  if (result.error || !result.data) throw storageError(result.error);
  return { id: result.data.id, paymentStatus: "paid" };
}
