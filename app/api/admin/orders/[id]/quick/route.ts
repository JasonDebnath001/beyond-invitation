import { NextResponse, type NextRequest } from "next/server";
import { getFulfillmentAdmin } from "@/lib/admin-auth";
import { bookQuickPickup, quoteQuickPickup, refreshQuickBooking, FulfillmentError } from "@/lib/order-fulfillment";
import { adminOrdersError, adminOrdersHeaders, checkFulfillmentOrigin, checkOrderId, readFulfillmentBody } from "@/lib/admin/order-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkFulfillmentOrigin(request);
    await getFulfillmentAdmin();
    const id = checkOrderId((await context.params).id);
    const body = await readFulfillmentBody(request);
    if (body.operation === "quote")
      return NextResponse.json(await quoteQuickPickup(id), { headers: adminOrdersHeaders });
    const order = body.operation === "book"
      ? await bookQuickPickup(id, body.courierId, body.expectedRatePaise)
      : body.operation === "refresh" ? await refreshQuickBooking(id) : null;
    if (!order) throw new FulfillmentError("INVALID_OPERATION", "Choose a valid Quick booking action.", 400);
    return NextResponse.json({ order }, { headers: adminOrdersHeaders });
  } catch (error) {
    return adminOrdersError(error);
  }
}
