import { redirect } from "next/navigation";
import OrderShippingDashboard from "@/components/admin/OrderShippingDashboard";
import { FulfillmentAdminError, getFulfillmentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let accessError: string | undefined;
  try {
    await getFulfillmentAdmin();
  } catch (error) {
    if (error instanceof FulfillmentAdminError && error.status === 401) {
      redirect("/sign-in?next=%2Fadmin%2Forders");
    }
    accessError = error instanceof FulfillmentAdminError
      ? error.message
      : "Staff access could not be verified. Please try again shortly.";
  }
  return <OrderShippingDashboard accessError={accessError} />;
}
