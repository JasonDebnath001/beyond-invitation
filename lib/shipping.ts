export type DeliveryLocation = { latitude: number; longitude: number };
export type ShippingService = "standard" | "quick";
export type ShippingSelection = { service: ShippingService; deliveryLocation?: DeliveryLocation; deliveryPlaceId?: string };

/** Opaque Google place reference; never accept a URL or unbounded input. */
export function isValidDeliveryPlaceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,512}$/.test(value);
}

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
  if (!isValidDeliveryLocation(input.deliveryLocation)) throw new ShippingSelectionError("DELIVERY_LOCATION_REQUIRED", "Enter your full delivery address to check Shiprocket Quick.");
  if (input.deliveryPlaceId !== undefined && !isValidDeliveryPlaceId(input.deliveryPlaceId))
    throw new ShippingSelectionError("INVALID_DELIVERY_LOCATION", "Please locate your delivery address again.");
  return { service: "quick", deliveryLocation: { latitude: input.deliveryLocation.latitude, longitude: input.deliveryLocation.longitude },
    ...(input.deliveryPlaceId !== undefined ? { deliveryPlaceId: input.deliveryPlaceId as string } : {}),
  };
}

/** Public quote data. Credentials and pickup addresses stay on the server. */
export interface ShippingQuote {
  /** Older saved quotes without a service are standard delivery. */
  service?: ShippingService;
  deliveryLocation?: DeliveryLocation;
  /** Retained with the order; Google coordinates are resolved afresh for fulfillment. */
  deliveryPlaceId?: string;
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
