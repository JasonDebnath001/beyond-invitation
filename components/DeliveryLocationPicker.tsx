"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { isValidDeliveryLocation, type DeliveryLocation } from "@/lib/shipping";

type Props = {
  value?: DeliveryLocation;
  /** A geocoded suggestion centres the map but still needs customer confirmation. */
  suggestedLocation?: DeliveryLocation;
  disabled?: boolean;
  onConfirm: (location: DeliveryLocation) => void;
  onInvalidate: () => void;
};

export default function DeliveryLocationPicker({ value, suggestedLocation, onConfirm, onInvalidate, disabled = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const placePin = useRef<((point: DeliveryLocation, centre?: boolean, invalidate?: boolean) => void) | null>(null);
  const callbacks = useRef({ onConfirm, onInvalidate, disabled });
  callbacks.current = { onConfirm, onInvalidate, disabled };
  const locationRequest = useRef(0);
  const acceptedPoint = isValidDeliveryLocation(value) ? value : undefined;
  const suggestedPoint = isValidDeliveryLocation(suggestedLocation) ? suggestedLocation : undefined;
  const initialPoint = useRef(acceptedPoint ?? suggestedPoint);
  initialPoint.current = acceptedPoint ?? suggestedPoint;
  const acceptedKey = acceptedPoint ? `${acceptedPoint.latitude},${acceptedPoint.longitude}` : "";
  const suggestedKey = suggestedPoint ? `${suggestedPoint.latitude},${suggestedPoint.longitude}` : "";
  const observedPoints = useRef({ acceptedKey, suggestedKey });
  const [candidate, setCandidate] = useState<DeliveryLocation | undefined>(acceptedPoint ?? suggestedPoint);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const confirmed = Boolean(value && candidate && value.latitude === candidate.latitude && value.longitude === candidate.longitude);

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    async function loadMap() {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;
        const point = initialPoint.current;
        const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
          point ? [point.latitude, point.longitude] : [22.9734, 78.6569], point ? 17 : 4,
        );
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(instance);
        const icon = L.divIcon({
          className: "delivery-map-pin",
          html: '<span style="display:block;width:24px;height:24px;border:4px solid white;border-radius:50%;background:#78182d;box-shadow:0 1px 6px #0008"></span>',
          iconSize: [24, 24], iconAnchor: [12, 12],
        });
        function updatePin(location: DeliveryLocation, centre = false, invalidate = true) {
          if (!isValidDeliveryLocation(location) || (invalidate && callbacks.current.disabled)) return;
          const latLng: [number, number] = [location.latitude, location.longitude];
          if (!marker.current) {
            marker.current = L.marker(latLng, { icon, draggable: true, title: "Delivery location. Drag to adjust." }).addTo(instance);
            marker.current.on("dragend", () => {
              const position = marker.current!.getLatLng();
              updatePin({ latitude: position.lat, longitude: position.lng });
            });
          } else marker.current.setLatLng(latLng);
          if (centre) instance.setView(latLng, 17);
          setCandidate(location);
          setError("");
          if (invalidate) callbacks.current.onInvalidate();
        }
        placePin.current = updatePin;
        instance.on("click", (event) => updatePin({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
        if (point) updatePin(point, false, false);
        setReady(true);
      } catch {
        if (!cancelled) setError("The delivery map could not load. Reload this page to try again, or choose standard delivery.");
      }
    }
    void loadMap();
    return () => {
      cancelled = true;
      active.current = false;
      // This request counter deliberately advances at cleanup to invalidate pending callbacks.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      locationRequest.current++;
      placePin.current = null;
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const previous = observedPoints.current;
    observedPoints.current = { acceptedKey, suggestedKey };
    if (!ready || disabled) return;
    // Removing an accepted value is how a manual drag invalidates it. Do not
    // snap that drag back to an unchanged, earlier geocoding suggestion.
    const next = acceptedKey && acceptedKey !== previous.acceptedKey ? acceptedPoint :
      !acceptedKey && suggestedKey && suggestedKey !== previous.suggestedKey ? suggestedPoint : undefined;
    if (!next) return;
    locationRequest.current++;
    setLocating(false);
    placePin.current?.(next, true, false);
  }, [acceptedKey, suggestedKey, acceptedPoint, suggestedPoint, ready, disabled]);

  useEffect(() => {
    if (disabled) {
      // A location lookup started before Pay Now must never change that payment's destination.
      locationRequest.current++;
      setLocating(false);
    }
    const method = disabled ? "disable" : "enable";
    map.current?.dragging?.[method]();
    map.current?.touchZoom?.[method]();
    map.current?.doubleClickZoom?.[method]();
    map.current?.boxZoom?.[method]();
    map.current?.keyboard?.[method]();
    marker.current?.dragging?.[method]();
  }, [disabled, ready]);

  function locate() {
    if (callbacks.current.disabled) return;
    if (!navigator.geolocation) {
      setError("Location is unavailable in this browser. Choose your delivery point on the map.");
      return;
    }
    setLocating(true);
    setError("");
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (!active.current || callbacks.current.disabled || request !== locationRequest.current) return;
      setLocating(false);
      placePin.current?.({ latitude: position.coords.latitude, longitude: position.coords.longitude }, true);
    }, () => {
      if (!active.current || callbacks.current.disabled || request !== locationRequest.current) return;
      setLocating(false);
      setError("Your location could not be accessed. You can still choose your delivery point on the map.");
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-ink-mid">Zoom in and click the map or drag the pin to your delivery entrance. The pin must match your address and pincode.</p>
      <button type="button" onClick={locate} disabled={disabled || !ready || locating} className="rounded-lg border border-gold/40 px-3 py-2 text-sm font-semibold text-maroon disabled:opacity-50">
        {locating ? "Finding your location…" : "Use my current location"}
      </button>
      <div ref={container} role="region" aria-label="Choose your exact delivery location on the map" inert={disabled} className="relative z-0 h-64 w-full overflow-hidden rounded-xl border border-gold/30 bg-gold-pale" />
      {!ready && !error && <p role="status" className="text-sm text-ink-mid">Loading delivery map…</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || !ready} onClick={() => {
          const centre = map.current?.getCenter();
          if (centre) placePin.current?.({ latitude: centre.lat, longitude: centre.lng });
        }} className="rounded-lg border border-gold/40 px-3 py-2 text-sm text-maroon disabled:opacity-50">Use map centre</button>
        <button type="button" disabled={disabled || !candidate || confirmed || !ready} onClick={() => {
          if (candidate && !callbacks.current.disabled) callbacks.current.onConfirm(candidate);
        }} className="rounded-lg bg-maroon px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {confirmed ? "Delivery location confirmed" : "Confirm delivery location"}
        </button>
      </div>
      <p role="status" className={`text-sm ${error ? "text-red-700" : "text-ink-mid"}`}>
        {error || (confirmed ? "Your pin is saved. Changing your address or pin will require confirmation again." : candidate ? "Check the pin, then confirm this delivery location to calculate Quick shipping." : "Choose a delivery point to check local delivery availability.")}
      </p>
    </div>
  );
}
