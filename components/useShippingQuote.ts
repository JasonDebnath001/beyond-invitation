"use client";

import { useCallback, useEffect, useState } from "react";
import { isValidIndianPincode, isValidDeliveryLocation, type ShippingQuote, type ShippingSelection } from "@/lib/shipping";
import type { CheckoutItem } from "@/components/useRazorpayCheckout";

type QuoteState = {
  key: string;
  status: "loading" | "ready" | "error";
  quote: ShippingQuote | null;
  error: string;
};

/** Quotes are tied to both the pincode and current quantities, and never persisted. */
export function useShippingQuote(items: CheckoutItem[], pincode: string, selection: ShippingSelection = { service: "standard" }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QuoteState | null>(null);
  const validPincode = isValidIndianPincode(pincode);
  const service = selection.service;
  const deliveryLocation = service === "quick" && isValidDeliveryLocation(selection.deliveryLocation) ? selection.deliveryLocation : undefined;
  const locationRequired = service === "quick" && !deliveryLocation;
  const payload = JSON.stringify({
    pincode,
    service,
    ...(deliveryLocation ? { deliveryLocation } : {}),
    items: items.map(({ itemCode, slug, quantity }) => ({ itemCode, slug, quantity })),
  });
  const key = validPincode && !locationRequired && items.length > 0 ? `${attempt}:${payload}` : "";
  const refresh = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    setState({ key, status: "loading", quote: null, error: "" });
    const debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Shipping could not be calculated. Please try again.");
        }
        const quote = result?.quote as ShippingQuote | undefined;
        if (!quote || quote.pincode !== pincode || quote.currency !== "INR" ||
            (quote.service ?? "standard") !== service ||
            (service === "quick" && (!isValidDeliveryLocation(quote.deliveryLocation) ||
              quote.deliveryLocation.latitude !== deliveryLocation?.latitude || quote.deliveryLocation.longitude !== deliveryLocation?.longitude)) ||
            !Number.isSafeInteger(quote.amountPaise) || quote.amountPaise < 0 ||
            !Number.isSafeInteger(quote.subtotalPaise) || quote.subtotalPaise < 0 ||
            !Number.isSafeInteger(quote.totalPaise) ||
            quote.totalPaise !== quote.subtotalPaise + quote.amountPaise ||
            !Number.isFinite(quote.expiresAt) || quote.expiresAt <= Date.now()) {
          throw new Error("Shipping could not be calculated. Please try again.");
        }
        if (controller.signal.aborted) return;
        setState({ key, status: "ready", quote, error: "" });
        expiryTimer = setTimeout(refresh, Math.min(quote.expiresAt - Date.now(), 2_147_483_647));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          key,
          status: "error",
          quote: null,
          error: error instanceof Error ? error.message : "Shipping could not be calculated. Please try again.",
        });
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(debounceTimer);
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [key, payload, pincode, refresh, service, deliveryLocation?.latitude, deliveryLocation?.longitude]);

  const current = state?.key === key ? state : null;
  const quote = current?.status === "ready" && current.quote && current.quote.expiresAt > Date.now()
    ? current.quote
    : null;
  return {
    quote,
    loading: Boolean(key) && (!current || current.status === "loading"),
    error: key && current?.status === "error" ? current.error : "",
    validPincode,
    locationRequired,
    refresh,
  };
}
