import "server-only";

import { NextResponse } from "next/server";
import { FulfillmentAdminError } from "@/lib/admin-auth";
import { FulfillmentError } from "@/lib/order-fulfillment";

export const adminOrdersHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export class AdminOrderRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AdminOrderRequestError";
  }
}

export function checkFulfillmentOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    throw new AdminOrderRequestError("Open order shipping on this website to make changes.", 403);
  }
}

export function checkOrderId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new AdminOrderRequestError("Select a valid website order.");
  }
  return id;
}

/** Bound both declared and streamed bodies before parsing staff commands. */
export async function readFulfillmentBody(request: Request): Promise<Record<string, unknown>> {
  const limit = 8 * 1024;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AdminOrderRequestError("Send order details as JSON.", 415);
  }
  if (Number(request.headers.get("content-length")) > limit) {
    throw new AdminOrderRequestError("These order details are too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AdminOrderRequestError("Send the order details.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new AdminOrderRequestError("These order details are too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AdminOrderRequestError("Send valid order details.");
  }
}

export function adminOrdersError(error: unknown) {
  if (error instanceof FulfillmentError || error instanceof FulfillmentAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: adminOrdersHeaders });
  }
  if (error instanceof AdminOrderRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: adminOrdersHeaders });
  }
  return NextResponse.json(
    { error: "Order shipping is temporarily unavailable. Please try again." },
    { status: 503, headers: adminOrdersHeaders },
  );
}
