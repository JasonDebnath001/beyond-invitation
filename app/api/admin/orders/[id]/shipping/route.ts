import { NextResponse, type NextRequest } from "next/server";
import { getFulfillmentAdmin } from "@/lib/admin-auth";
import { createOrderShipment } from "@/lib/order-fulfillment";
import { adminOrdersError, adminOrdersHeaders, checkFulfillmentOrigin, checkOrderId, readFulfillmentBody } from "@/lib/admin/order-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkFulfillmentOrigin(request);
    await getFulfillmentAdmin();
    const orderId = checkOrderId((await context.params).id);
    const body = await readFulfillmentBody(request);
    const order = await createOrderShipment(orderId, body.package);
    return NextResponse.json({ order }, { headers: adminOrdersHeaders });
  } catch (error) {
    return adminOrdersError(error);
  }
}
