import "server-only";

import type { ResolvedCart } from "@/lib/checkout";
import { getShiprocketRates, ShiprocketError } from "@/lib/shiprocket";
import { isValidIndianPincode, type ShippingQuote } from "@/lib/shipping";

const QUOTE_LIFETIME_MS = 5 * 60 * 1000;
const MAX_PAYMENT_PAISE = 2147483647;
const MAX_CACHED_QUOTES = 200;
const cache = new Map<string, ShippingQuote>();
const pending = new Map<string, Promise<ShippingQuote>>();

export class ShippingQuoteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "ShippingQuoteError";
  }
}

function unavailable() {
  return new ShippingQuoteError(
    "SHIPROCKET_UNAVAILABLE",
    "Shipping rates are temporarily unavailable. Please try again shortly.",
    503,
  );
}

/** Only call with a cart resolved against the authoritative catalogue. */
export async function quoteCartShipping(
  cart: ResolvedCart,
  pincode: string,
  options: { refresh?: boolean } = {},
): Promise<ShippingQuote> {
  if (!isValidIndianPincode(pincode)) {
    throw new ShippingQuoteError(
      "INVALID_PINCODE",
      "Enter a valid six-digit Indian pincode.",
      400,
    );
  }
  if (
    !cart.lines.length ||
    cart.lines.some(
      (line) =>
        !Number.isSafeInteger(line.quantity) ||
        line.quantity <= 0 ||
        line.quantity > 10000,
    )
  ) {
    throw new ShippingQuoteError(
      "INVALID_CART",
      "Please check the quantities in your cart.",
      400,
    );
  }
  if (
    !Number.isSafeInteger(cart.amountPaise) ||
    cart.amountPaise < 100 ||
    cart.amountPaise > MAX_PAYMENT_PAISE
  ) {
    throw new ShippingQuoteError(
      "INVALID_TOTAL",
      "Cart total is outside the supported payment amount.",
      400,
    );
  }
  if (
    cart.lines.some(
      (line) =>
        typeof line.weightGrams !== "number" ||
        !Number.isFinite(line.weightGrams) ||
        line.weightGrams <= 0,
    )
  ) {
    throw new ShippingQuoteError(
      "WEIGHT_MISSING",
      "Shipping cannot be calculated for one or more items yet. Please contact us for a delivery quote.",
    );
  }
  // Item measurements are not packed-parcel dimensions. Do not invent a box
  // size or a fallback weight. Round up to the nearest gram for the estimate.
  const weightKg =
    Math.ceil(
      cart.lines.reduce(
        (grams, line) => grams + line.weightGrams! * line.quantity,
        0,
      ),
    ) / 1000;
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw unavailable();

  const key = JSON.stringify([
    process.env.SHIPROCKET_EMAIL,
    process.env.SHIPROCKET_PICKUP_LOCATION,
    pincode,
    weightKg,
    cart.amountPaise,
  ]);
  const cached = cache.get(key);
  if (!options.refresh && cached && cached.expiresAt > Date.now())
    return { ...cached };
  if (!options.refresh && pending.has(key))
    return { ...(await pending.get(key)!) };

  const lookup = (async (): Promise<ShippingQuote> => {
    let rates;
    try {
      rates = await getShiprocketRates({
        deliveryPincode: pincode,
        weightKg,
        cod: false,
      });
    } catch (error) {
      if (error instanceof ShiprocketError && error.httpStatus === 404) {
        throw new ShippingQuoteError(
          "UNSERVICEABLE",
          "Delivery is currently unavailable for this pincode. Please try another pincode or contact us.",
        );
      }
      throw unavailable();
    }
    if (!rates.couriers.length) {
      throw new ShippingQuoteError(
        "UNSERVICEABLE",
        "Delivery is currently unavailable for this pincode. Please try another pincode or contact us.",
      );
    }
    if (
      rates.couriers.some(
        (courier) =>
          !Number.isFinite(courier.rate) ||
          courier.rate < 0 ||
          !Number.isSafeInteger(courier.id) ||
          courier.id <= 0 ||
          !courier.name,
      )
    )
      throw unavailable();
    const courier = [...rates.couriers].sort(
      (a, b) => a.rate - b.rate || a.id - b.id,
    )[0];
    const amountPaise = Math.round(courier.rate * 100);
    const totalPaise = cart.amountPaise + amountPaise;
    if (
      !Number.isSafeInteger(amountPaise) ||
      !Number.isSafeInteger(totalPaise) ||
      totalPaise > MAX_PAYMENT_PAISE
    ) {
      throw new ShippingQuoteError(
        "INVALID_TOTAL",
        "Order total is outside the supported payment amount.",
        400,
      );
    }
    return {
      pincode,
      subtotalPaise: cart.amountPaise,
      amountPaise,
      totalPaise,
      currency: "INR",
      weightKg,
      courierId: courier.id,
      courierName: courier.name,
      estimatedDeliveryDays: courier.estimatedDeliveryDays,
      expiresAt: Date.now() + QUOTE_LIFETIME_MS,
    };
  })();
  if (!options.refresh && pending.size < MAX_CACHED_QUOTES)
    pending.set(key, lookup);
  try {
    const quote = await lookup;
    for (const [entryKey, entry] of cache) {
      if (entry.expiresAt <= Date.now()) cache.delete(entryKey);
    }
    if (cache.size >= MAX_CACHED_QUOTES)
      cache.delete(cache.keys().next().value!);
    cache.set(key, quote);
    return { ...quote };
  } finally {
    if (pending.get(key) === lookup) pending.delete(key);
  }
}
