import "server-only";

import type { ResolvedCart } from "@/lib/checkout";
import { getShiprocketRates, getShiprocketQuickRates, ShiprocketError } from "@/lib/shiprocket";
import { isValidIndianPincode, parseShippingSelection, ShippingSelectionError, type ShippingQuote } from "@/lib/shipping";

const QUOTE_LIFETIME_MS = 5 * 60 * 1000;
const SHIPPING_MARKUP_PAISE = 5_000; // Flat INR 50 per order, included in the customer's shipping fee.
const MAX_PAYMENT_PAISE = 2147483647;
const MAX_CACHED_QUOTES = 200;
const cache = new Map<string, ShippingQuote>();
const pending = new Map<string, Promise<ShippingQuote>>();
const copyQuote = (quote: ShippingQuote): ShippingQuote => ({ ...quote,
  ...(quote.deliveryLocation ? { deliveryLocation: { ...quote.deliveryLocation } } : {}),
});

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
  options: { refresh?: boolean; service?: unknown; deliveryLocation?: unknown } = {},
): Promise<ShippingQuote> {
  let selection;
  try { selection = parseShippingSelection(options); }
  catch (error) {
    if (error instanceof ShippingSelectionError) throw new ShippingQuoteError(error.code, error.message, 400);
    throw error;
  }
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
    selection.service,
    selection.deliveryLocation,
  ]);
  const cached = cache.get(key);
  if (!options.refresh && cached && cached.expiresAt > Date.now())
    return copyQuote(cached);
  if (!options.refresh && pending.has(key))
    return copyQuote(await pending.get(key)!);

  const lookup = (async (): Promise<ShippingQuote> => {
    let couriers: { id: number | null; name: string; rate: number; estimatedDeliveryDays: number | null }[];
    try {
      if (selection.service === "quick") {
        const rates = await getShiprocketQuickRates({ deliveryPincode: pincode, deliveryLocation: selection.deliveryLocation!, weightKg, cod: false });
        couriers = rates.couriers.map((courier) => ({ ...courier, id: null, estimatedDeliveryDays: null }));
      } else {
        couriers = (await getShiprocketRates({ deliveryPincode: pincode, weightKg, cod: false })).couriers;
      }
    } catch (error) {
      if (error instanceof ShiprocketError && error.httpStatus === 404) {
        throw new ShippingQuoteError(
          "UNSERVICEABLE",
          selection.service === "quick" ? "Shiprocket Quick is unavailable for this location and parcel. Choose standard delivery or check your map pin." : "Delivery is currently unavailable for this pincode. Please try another pincode or contact us.",
        );
      }
      throw unavailable();
    }
    if (!couriers.length) {
      throw new ShippingQuoteError(
        "UNSERVICEABLE",
        selection.service === "quick" ? "Shiprocket Quick is unavailable for this location and parcel. Choose standard delivery or check your map pin." : "Delivery is currently unavailable for this pincode. Please try another pincode or contact us.",
      );
    }
    if (
      couriers.some(
        (courier) =>
          !Number.isFinite(courier.rate) ||
          courier.rate < 0 ||
          (selection.service !== "quick" && (!Number.isSafeInteger(courier.id) || courier.id! <= 0)) ||
          !courier.name,
      )
    )
      throw unavailable();
    const courier = [...couriers].sort(
      (a, b) => a.rate - b.rate || (a.id ?? 0) - (b.id ?? 0) || a.name.localeCompare(b.name),
    )[0];
    const amountPaise = Math.round(courier.rate * 100) + SHIPPING_MARKUP_PAISE;
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
      ...(selection.service === "quick" ? { service: "quick" as const, deliveryLocation: { ...selection.deliveryLocation! } } : {}),
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
    return copyQuote(quote);
  } finally {
    if (pending.get(key) === lookup) pending.delete(key);
  }
}
