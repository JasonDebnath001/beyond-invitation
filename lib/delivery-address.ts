import { isValidIndianPincode } from "@/lib/shipping";

/** Address fields only: contact details and order notes are not sent to geocoding. */
export type DeliveryAddressInput = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

function field(value: unknown, maximum: number, minimum = 0): string | null {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= minimum ? normalized : null;
}

export function normalizeDeliveryAddress(
  value: unknown,
): DeliveryAddressInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const addressLine1 = field(input.addressLine1, 200, 5);
  const addressLine2 = field(input.addressLine2 ?? "", 200);
  const city = field(input.city, 80, 2);
  const state = field(input.state, 80, 2);
  const pincode = field(input.pincode, 6, 6);
  const country = field(input.country, 40, 2);
  if (
    addressLine1 === null ||
    addressLine2 === null ||
    city === null ||
    state === null ||
    !isValidIndianPincode(pincode) ||
    country === null ||
    !/^(india|in)$/i.test(country)
  )
    return null;
  return { addressLine1, addressLine2, city, state, pincode, country: "India" };
}

/** Used only to tie a checkout result to the current form; never put this key in a URL or log. */
export function deliveryAddressKey(value: unknown): string {
  const address = normalizeDeliveryAddress(value);
  return address
    ? JSON.stringify([
        address.addressLine1.toLocaleLowerCase("en-IN"),
        address.addressLine2.toLocaleLowerCase("en-IN"),
        address.city.toLocaleLowerCase("en-IN"),
        address.state.toLocaleLowerCase("en-IN"),
        address.pincode,
        "india",
      ])
    : "";
}
