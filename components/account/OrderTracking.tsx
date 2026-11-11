"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, RefreshCw, Truck } from "lucide-react";
import type { OrderTracking as TrackingDetails } from "@/lib/order-tracking-types";
import { linkClass, secondaryClass } from "./AccountUI";

const REQUEST_TIMEOUT_MS = 40_000;

function isTrackingDetails(value: unknown): value is TrackingDetails {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const optionalText = ["courierName", "awb", "trackingUrl", "estimatedDeliveryAt", "deliveredAt"];
  return ["preparing", "awaiting_tracking", "tracking", "test_order"].includes(String(data.state)) &&
    typeof data.status === "string" && typeof data.checkedAt === "string" &&
    optionalText.every((key) => data[key] === null || typeof data[key] === "string") &&
    Array.isArray(data.events) && data.events.every((event) => event && typeof event === "object" &&
      typeof event.date === "string" && typeof event.status === "string" &&
      (event.location === null || typeof event.location === "string"));
}

function trackingLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const trustedHost = ["shiprocket.in", "shiprocket.co"].some((host) =>
      url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && trustedHost && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function trackingDate(value: string, includeTime = true): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } as const : {}),
  }).format(date);
}

export default function OrderTracking({ orderId, trackingToken }: { orderId: string; trackingToken?: string }) {
  const [tracking, setTracking] = useState<TrackingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const active = useRef<AbortController | null>(null);
  const panelId = useId();

  useEffect(() => {
    setTracking(null);
    setError(null);
    setSignInRequired(false);
    setLoading(false);
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [orderId, trackingToken]);

  async function refresh() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    setSignInRequired(false);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(trackingToken ? "/api/orders/tracking" : `/api/account/orders/${encodeURIComponent(orderId)}/tracking`, {
        cache: "no-store", credentials: "same-origin", signal: controller.signal,
        ...(trackingToken ? {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, token: trackingToken }),
        } : {}),
      });
      if (active.current !== controller) return;
      if (!response.ok) {
        if (response.status === 401 && !trackingToken) {
          setSignInRequired(true);
          throw new Error("Please sign in again to view your order tracking.");
        }
        if (response.status === 404) throw new Error("Tracking is unavailable for this order. Please contact us for help.");
        throw new Error("We couldn’t check the delivery status. Please try again.");
      }
      const result = await response.json();
      if (!isTrackingDetails(result?.tracking)) throw new Error("We couldn’t check the delivery status. Please try again.");
      if (active.current !== controller || controller.signal.aborted) return;
      setTracking(result.tracking);
    } catch (reason) {
      if (active.current !== controller) return;
      setError(controller.signal.aborted
        ? "Checking the delivery status took too long. Please try again."
        : reason instanceof Error && [
          "Please sign in again to view your order tracking.",
          "Tracking is unavailable for this order. Please contact us for help.",
          "We couldn’t check the delivery status. Please try again.",
        ].includes(reason.message) ? reason.message : "We couldn’t check the delivery status. Please try again.");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  }

  const href = trackingLink(tracking?.trackingUrl ?? null);
  const estimatedDelivery = tracking?.estimatedDeliveryAt ? trackingDate(tracking.estimatedDeliveryAt, false) : null;
  const delivered = tracking?.deliveredAt ? trackingDate(tracking.deliveredAt) : null;
  const checked = tracking?.checkedAt ? trackingDate(tracking.checkedAt) : null;
  const showPanel = loading || Boolean(tracking) || Boolean(error);

  return (
    <div className="mb-5 min-w-0">
      <button type="button" onClick={() => void refresh()} disabled={loading}
        aria-controls={panelId} aria-expanded={showPanel} className={secondaryClass}>
        {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          : tracking ? <RefreshCw aria-hidden="true" className="h-4 w-4" /> : <Truck aria-hidden="true" className="h-4 w-4" />}
        {loading ? "Checking delivery…" : error ? "Retry tracking" : tracking ? "Refresh tracking" : "Track order"}
      </button>
      <div id={panelId} hidden={!showPanel} aria-busy={loading} className="mt-4 rounded-xl border border-gold/20 bg-paper/60 p-4 sm:p-5">
        {loading && <p role="status" className="text-sm text-ink-mid">Checking the latest delivery information…</p>}
        {error && <div role="alert" className="mb-3 text-sm text-red-800">
          <p>{error}</p>
          {tracking && <p className="mt-1">Showing the last available update below; it may be out of date.</p>}
          {signInRequired && <a href="/sign-in?next=%2Faccount" className={`mt-2 ${linkClass}`}>Sign in</a>}
        </div>}
        {tracking && <div>
          <h3 className="text-base font-semibold text-carbon">{tracking.status}</h3>
          {tracking.state === "preparing" && <p className="mt-2 text-sm leading-relaxed text-ink-mid">Your order is being prepared. Tracking will be available after your parcel is booked with a courier.</p>}
          {tracking.state === "awaiting_tracking" && <p className="mt-2 text-sm leading-relaxed text-ink-mid">Delivery updates will appear here when the courier makes them available.</p>}
          {tracking.state === "test_order" && <p className="mt-2 text-sm leading-relaxed text-ink-mid">This is a test order and has no live delivery to track.</p>}
          {(tracking.courierName || tracking.awb || delivered || estimatedDelivery) &&
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {tracking.courierName && <div><dt className="text-ink-mid">Courier</dt><dd className="mt-1 break-words font-medium text-ink">{tracking.courierName}</dd></div>}
              {tracking.awb && <div><dt className="text-ink-mid">Tracking number (AWB)</dt><dd className="mt-1 break-all font-medium text-ink">{tracking.awb}</dd></div>}
              {delivered ? <div><dt className="text-ink-mid">Delivered</dt><dd className="mt-1 font-medium text-ink">{delivered}</dd></div>
                : estimatedDelivery && <div><dt className="text-ink-mid">Estimated delivery</dt><dd className="mt-1 font-medium text-ink">{estimatedDelivery}</dd></div>}
            </dl>}
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className={`mt-4 ${linkClass}`}>View on Shiprocket<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
          {tracking.events.length > 0 && <div className="mt-5 border-t border-gold/20 pt-4">
            <h4 className="text-sm font-semibold text-carbon">Delivery updates</h4>
            <ol className="mt-3 space-y-4">
              {tracking.events.map((event, index) => {
                const date = trackingDate(event.date);
                return <li key={`${event.date}-${index}`} className="border-l-2 border-gold/35 pl-3 text-sm">
                  <p className="font-medium text-ink">{event.status}</p>
                  {event.location && <p className="mt-1 break-words text-ink-mid">{event.location}</p>}
                  {date && <time dateTime={event.date} className="mt-1 block text-ink-mid">{date}</time>}
                </li>;
              })}
            </ol>
          </div>}
          {checked && <p className="mt-4 text-xs text-ink-mid">Last checked {checked}. All times shown in India time.</p>}
        </div>}
      </div>
    </div>
  );
}
