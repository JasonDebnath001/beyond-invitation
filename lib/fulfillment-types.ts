/** Public admin view types. Credentials and raw provider responses never belong here. */
export interface ShipmentPackage {
  weightKg: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

export type FulfillmentState = "not_created" | "creating" | "created" | "failed" | "needs_review";

export type QuickBookingState = "not_booked" | "booking" | "pending" | "booked" | "failed" | "needs_review";
export interface QuickBooking {
  state: QuickBookingState;
  courierId: number | null;
  courierName: string | null;
  awb: string | null;
  estimatedRatePaise: number | null;
  updatedAt: string | null;
  error: string | null;
}
export interface QuickFulfillmentQuote {
  amountPaise: number;
  currency: "INR";
  courierName: string;
  weightKg: number;
}

export interface FulfillmentOrder {
  id: string;
  createdAt: string;
  paidAt: string | null;
  paymentStatus: "pending" | "paid";
  paymentMode: "test" | "live" | "unknown";
  amountPaise: number;
  currency: string;
  customer: { name: string; email: string; phone: string };
  address: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  notes: string;
  items: { itemCode: string; name: string; quantity: number; price: number }[];
  shippingAmountPaise: number | null;
  deliveryService: "standard" | "quick";
  deliveryLocation: { latitude: number; longitude: number } | null;
  fulfillment: {
    state: FulfillmentState;
    merchantOrderId: string;
    package: ShipmentPackage | null;
    shiprocketOrderId: number | null;
    shipmentId: number | null;
    updatedAt: string | null;
    error: string | null;
    quickBooking: QuickBooking | null;
  };
  canCreateShipment: boolean;
  canReconcileShipment: boolean;
  canBookQuickPickup: boolean;
  blockedReason: string | null;
}
