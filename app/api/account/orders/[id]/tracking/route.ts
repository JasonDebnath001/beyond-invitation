import { NextResponse } from "next/server";
import { getCustomerOrderTracking } from "@/lib/order-tracking";
import { trackingErrorResponse, trackingHeaders } from "@/lib/order-tracking-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const tracking = await getCustomerOrderTracking(id);
    return NextResponse.json({ tracking }, { headers: trackingHeaders });
  } catch (error) { return trackingErrorResponse(error); }
}
