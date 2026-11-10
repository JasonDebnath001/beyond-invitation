/** Public quote data. Credentials and pickup addresses stay on the server. */
export interface ShippingQuote {
  pincode: string;
  subtotalPaise: number;
  amountPaise: number;
  totalPaise: number;
  currency: "INR";
  weightKg: number;
  courierId: number;
  courierName: string;
  estimatedDeliveryDays: number | null;
  expiresAt: number;
}

export function isValidIndianPincode(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{5}$/.test(value);
}
