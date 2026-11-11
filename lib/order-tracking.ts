import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getShiprocketTracking } from "@/lib/shiprocket";
import { verifyOrderTrackingToken } from "@/lib/order-tracking-token";
import type { OrderTracking } from "@/lib/order-tracking-types";

export class OrderTrackingError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = "OrderTrackingError";
  }
}

type OrderRow = {
  id: string;
  user_id: string | null;
  payment_status: string;
  shipping_address: unknown;
};
const COLUMNS = "id,user_id,payment_status,shipping_address";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const notFound = () => new OrderTrackingError("ORDER_NOT_FOUND", "This order or private tracking link is unavailable. Check your link or sign in to My Orders.", 404);

// Only provider results are cached. Ownership/token checks and the order snapshot are read on EVERY request.
// No JSONB writes: tracking cannot overwrite the fulfillment creation/reconciliation lock.
const trackingCache = new Map<string, { expiresAt: number; promise: Promise<OrderTracking> }>();
const MAX_CACHE_ENTRIES = 200;

function emptyTracking(state: OrderTracking["state"], status: string): OrderTracking {
  return { state, status, courierName: null, awb: null, trackingUrl: null,
    estimatedDeliveryAt: null, deliveredAt: null, events: [], checkedAt: new Date().toISOString() };
}

async function trackingForOrder(row: OrderRow): Promise<OrderTracking> {
  const address = record(row.shipping_address);
  if (address.paymentMode === "test") return emptyTracking("test_order", "Test order — no delivery will be booked.");
  if (row.payment_status !== "paid") return emptyTracking("preparing", "Waiting for payment confirmation.");
  const fulfillment = record(address.fulfillment);
  if (fulfillment.state !== "created") return emptyTracking("preparing", "Your order is being prepared. Tracking will appear after it is booked with a courier.");
  if (address.paymentMode !== "live" || !positiveId(fulfillment.shipmentId) || !positiveId(fulfillment.shiprocketOrderId)) {
    throw new OrderTrackingError("TRACKING_UNAVAILABLE", "Tracking is temporarily unavailable. Please try again later.", 503);
  }

  const namespace = createHash("sha256").update(JSON.stringify([
    process.env.SHIPROCKET_EMAIL, process.env.SHIPROCKET_PASSWORD, process.env.SHIPROCKET_PICKUP_LOCATION,
  ])).digest("hex");
  const key = `${namespace}:${row.id}:${fulfillment.shiprocketOrderId}:${fulfillment.shipmentId}`;
  const now = Date.now();
  const cached = trackingCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  for (const [cacheKey, entry] of trackingCache) if (entry.expiresAt <= now) trackingCache.delete(cacheKey);
  if (trackingCache.size >= MAX_CACHE_ENTRIES) trackingCache.delete(trackingCache.keys().next().value!);

  const promise = getShiprocketTracking(fulfillment.shipmentId, fulfillment.shiprocketOrderId).then((result): OrderTracking => ({
    state: result.available ? "tracking" : "awaiting_tracking",
    status: result.status || "Waiting for courier tracking updates.",
    courierName: result.courierName, awb: result.awb, trackingUrl: result.trackingUrl,
    estimatedDeliveryAt: result.estimatedDeliveryAt, deliveredAt: result.deliveredAt,
    events: result.events, checkedAt: new Date().toISOString(),
  })).catch(() => {
    if (trackingCache.get(key)?.promise === promise) trackingCache.delete(key);
    throw new OrderTrackingError("TRACKING_UNAVAILABLE", "Courier updates are temporarily unavailable. Please try again shortly.", 503);
  });
  trackingCache.set(key, { expiresAt: now + 60_000, promise });
  return promise;
}

export async function getCustomerOrderTracking(id: string): Promise<OrderTracking> {
  const client = await getSupabaseAuthServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new OrderTrackingError("SIGN_IN_REQUIRED", "Sign in to view tracking for your orders.", 401);
  if (!UUID.test(id)) throw notFound();
  // The request-scoped authenticated client applies RLS, with an explicit ownership filter as well.
  const { data, error } = await client.from("website_orders").select(COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new OrderTrackingError("ORDER_UNAVAILABLE", "Order tracking is temporarily unavailable. Please try again.", 503);
  if (!data || data.user_id !== user.id) throw notFound();
  return trackingForOrder(data as OrderRow);
}

export async function getGuestOrderTracking(id: unknown, token: unknown): Promise<OrderTracking> {
  if (typeof id !== "string" || !UUID.test(id) || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw notFound();
  const { data, error } = await getSupabaseAdminClient().from("website_orders").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new OrderTrackingError("ORDER_UNAVAILABLE", "Order tracking is temporarily unavailable. Please try again.", 503);
  if (!data || !verifyOrderTrackingToken(token, record(data.shipping_address).trackingTokenHash)) throw notFound();
  return trackingForOrder(data as OrderRow);
}
