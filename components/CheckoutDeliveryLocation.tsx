"use client";

import { useEffect, useRef, useState } from "react";
import { deliveryAddressKey, normalizeDeliveryAddress, type DeliveryAddressInput } from "@/lib/delivery-address";
import { isValidDeliveryLocation, isValidDeliveryPlaceId, type DeliveryLocation } from "@/lib/shipping";

type LookupState = {
  key: string;
  status: "loading" | "matched" | "review" | "not_found" | "error";
};
type Props = {
  address: DeliveryAddressInput;
  value?: DeliveryLocation;
  disabled?: boolean;
  onChange: (location: DeliveryLocation | undefined, addressKey: string, placeId?: string) => void;
  onSelectStandard: () => void;
};

/** Only a precise match for the current complete address can authorize Quick shipping. */
export default function CheckoutDeliveryLocation({ address, value, disabled = false, onChange, onSelectStandard }: Props) {
  const key = deliveryAddressKey(address);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null);
  const latest = useRef({ address, value, disabled, onChange, onSelectStandard, key });
  latest.current = { address, value, disabled, onChange, onSelectStandard, key };
  const current = lookup?.key === key ? lookup : null;
  const accepted = isValidDeliveryLocation(value);

  useEffect(() => {
    if (!key || disabled || isValidDeliveryLocation(latest.current.value)) return;
    const normalized = normalizeDeliveryAddress(latest.current.address);
    if (!normalized) return;
    const controller = new AbortController();
    request.current = controller;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setLookup({ key, status: "loading" });
    const isCurrent = () => !controller.signal.aborted && latest.current.key === key && !latest.current.disabled;
    const debounce = setTimeout(async () => {
      if (!isCurrent()) return;
      timeout = setTimeout(() => {
        if (!isCurrent()) return;
        setLookup({ key, status: "error" });
        controller.abort();
      }, 12_000);
      try {
        const response = await fetch("/api/locations/geocode", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: normalized }), cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (!isCurrent()) return;
        if (!response.ok || !["matched", "review", "not_found"].includes(result?.status) ||
            (result.status !== "not_found" && !isValidDeliveryLocation(result.location)) ||
            (result.status === "matched" && (result.provider !== "google" || !isValidDeliveryPlaceId(result.placeId)))) throw new Error("Location unavailable");
        setLookup({ key, status: result.status });
        if (result.status === "matched") latest.current.onChange({ latitude: result.location.latitude, longitude: result.location.longitude }, key, result.placeId);
      } catch {
        if (isCurrent()) setLookup({ key, status: "error" });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }, 800);
    return () => {
      controller.abort();
      clearTimeout(debounce);
      if (timeout) clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    };
  }, [key, disabled, attempt, accepted]);

  function selectStandard() {
    if (latest.current.disabled) return;
    request.current?.abort();
    latest.current.onSelectStandard();
  }

  function retry() {
    if (latest.current.disabled) return;
    request.current?.abort();
    latest.current.onChange(undefined, key);
    setAttempt((number) => number + 1);
  }

  // Matching is an internal checkout step. Only show help when customer action is needed;
  // no Google addresses, coordinates, suggestions or map content are displayed here.
  if (!key || accepted || !current || current.status === "loading" || current.status === "matched") return null;

  return <section className="mt-4 rounded-2xl border border-gold/20 p-4" aria-label="Quick delivery help">
    <p role="status" aria-live="polite" className="text-sm text-ink-mid">
      {current.status === "review" || current.status === "not_found" ? "We couldn’t locate the delivery building precisely. Check the building number, street and nearby landmark above, or use standard delivery."
        : "Automatic address lookup is temporarily unavailable. Try again or use standard delivery."}
    </p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      <button type="button" disabled={disabled} onClick={selectStandard} className="font-semibold text-maroon underline underline-offset-2 disabled:opacity-50">Use standard delivery</button>
      <button type="button" disabled={disabled} onClick={retry} className="font-semibold text-maroon underline underline-offset-2 disabled:opacity-50">Retry address lookup</button>
    </div>
  </section>;
}
