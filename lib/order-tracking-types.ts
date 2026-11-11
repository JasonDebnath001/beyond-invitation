/** Customer-safe tracking details. Provider payloads and order addresses stay on the server. */
export type OrderTracking = {
  state: "preparing" | "awaiting_tracking" | "tracking" | "test_order";
  status: string;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: { date: string; status: string; location: string | null }[];
  checkedAt: string;
};
