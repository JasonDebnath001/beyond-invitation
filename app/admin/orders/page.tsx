import OrderShippingDashboard from "@/components/admin/OrderShippingDashboard";
import { getFulfillmentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let canManageShipments = false;
  try {
    await getFulfillmentAdmin();
    canManageShipments = true;
  } catch {
    // Order viewing is public; the shipment mutation APIs still require staff.
  }
  return <OrderShippingDashboard canManageShipments={canManageShipments} />;
}
