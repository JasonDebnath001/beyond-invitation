import { NextResponse, type NextRequest } from "next/server";
import { listFulfillmentOrders } from "@/lib/order-fulfillment";
import { AdminOrderRequestError, adminOrdersError, adminOrdersHeaders } from "@/lib/admin/order-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const limitValue = request.nextUrl.searchParams.get("limit");
    const limit = limitValue === null ? 50 : Number(limitValue);
    const before = request.nextUrl.searchParams.get("before") || undefined;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (before !== undefined && (before.length > 40 || !Number.isFinite(Date.parse(before))))) {
      throw new AdminOrderRequestError("Choose a valid order page.");
    }
    const orders = await listFulfillmentOrders({ limit, before });
    return NextResponse.json({ orders }, { headers: adminOrdersHeaders });
  } catch (error) {
    return adminOrdersError(error);
  }
}
