import "server-only";

import { NextResponse } from "next/server";
import { OrderTrackingError } from "@/lib/order-tracking";

export const trackingHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Vary": "Cookie",
};

export function trackingErrorResponse(error: unknown) {
  if (error instanceof OrderTrackingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: trackingHeaders });
  }
  return NextResponse.json({ error: "Order tracking is temporarily unavailable. Please try again." }, { status: 503, headers: trackingHeaders });
}

/** Tokens travel in a small POST body, never in an API URL or an error/log message. */
export async function readTrackingRequest(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new OrderTrackingError("INVALID_ORIGIN", "Open your tracking link on this website.", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new OrderTrackingError("INVALID_BODY", "Send valid tracking details.", 415);
  }
  const limit = 2048;
  if (Number(request.headers.get("content-length")) > limit) throw new OrderTrackingError("BODY_TOO_LARGE", "Tracking details are too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new OrderTrackingError("INVALID_BODY", "Send valid tracking details.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new OrderTrackingError("BODY_TOO_LARGE", "Tracking details are too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new OrderTrackingError("INVALID_BODY", "Send valid tracking details.", 400);
  }
}
