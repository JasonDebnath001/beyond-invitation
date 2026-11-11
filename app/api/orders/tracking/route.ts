import { NextResponse } from "next/server";
import { getGuestOrderTracking } from "@/lib/order-tracking";
import { readTrackingRequest, trackingErrorResponse, trackingHeaders } from "@/lib/order-tracking-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readTrackingRequest(request);
    const tracking = await getGuestOrderTracking(body.orderId, body.token);
    return NextResponse.json({ tracking }, { headers: trackingHeaders });
  } catch (error) { return trackingErrorResponse(error); }
}
