export type DeliveryLocation = { latitude: number; longitude: number };
export type ShippingService = "standard" | "quick";
export type ShippingSelection = { service: ShippingService; deliveryLocation?: DeliveryLocation };

export function isValidDeliveryLocation(value: unknown): value is DeliveryLocation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return typeof point.latitude === "number" && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    typeof point.longitude === "number" && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

export class ShippingSelectionError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "ShippingSelectionError"; }
}

/** Prices and provider IDs are never accepted as part of the customer's delivery selection. */
export function parseShippingSelection(value: unknown): ShippingSelection {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (input.service === undefined || input.service === "standard") return { service: "standard" };
  if (input.service !== "quick") throw new ShippingSelectionError("INVALID_DELIVERY_SERVICE", "Choose standard delivery or Shiprocket Quick.");
  if (!isValidDeliveryLocation(input.deliveryLocation)) throw new ShippingSelectionError("DELIVERY_LOCATION_REQUIRED", "Pin and confirm your delivery location to check Shiprocket Quick.");
  return { service: "quick", deliveryLocation: { latitude: input.deliveryLocation.latitude, longitude: input.deliveryLocation.longitude } };
}

/** Public quote data. Credentials and pickup addresses stay on the server. */
export interface ShippingQuote {
  /** Older saved quotes without a service are standard delivery. */
  service?: ShippingService;
  deliveryLocation?: DeliveryLocation;
  pincode: string;
  subtotalPaise: number;
  amountPaise: number;
  totalPaise: number;
  currency: "INR";
  weightKg: number;
  courierId: number | null;
  courierName: string;
  estimatedDeliveryDays: number | null;
  expiresAt: number;
}

export function isValidIndianPincode(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{5}$/.test(value);
}
