"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import ProductPrice from "@/components/ProductPrice";
import { formatProductName } from "@/lib/product-name";
import { useRazorpayCheckout } from "@/components/useRazorpayCheckout";
import { useShippingQuote } from "@/components/useShippingQuote";
import DeliveryServiceSelector from "@/components/DeliveryServiceSelector";
import { isValidIndianPincode } from "@/lib/shipping";

type CheckoutForm = {
  name: string;
  email: string;
  contact: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  notes: string;
};

type StatesApiResponse = {
  states: string[];
  error?: string;
};

type CitiesApiResponse = {
  cities: string[];
  error?: string;
};

const initialForm: CheckoutForm = {
  name: "",
  email: "",
  contact: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  notes: "",
};

export default function CheckoutPage() {
  const { items, totalItems, totalPrice, clearCart, deliveryPincode, setDeliveryPincode, shippingSelection, setShippingSelection } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const { startCheckout, loading } = useRazorpayCheckout();

  const [form, setForm] = useState<CheckoutForm>(() => ({ ...initialForm, pincode: deliveryPincode }));
  const pincodeEdited = useRef(false);
  const shipping = useShippingQuote(items, form.pincode, shippingSelection);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [manualCityMode, setManualCityMode] = useState(false);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");

  const selectedStateHasCities = useMemo(() => {
    return Boolean(form.state && cities.length > 0);
  }, [form.state, cities.length]);

  useEffect(() => {
    if (pincodeEdited.current || !deliveryPincode) return;
    setForm((current) => current.pincode ? current : { ...current, pincode: deliveryPincode });
  }, [deliveryPincode]);

  useEffect(() => {
    if (!user) return;
    const name = user.user_metadata.full_name || user.user_metadata.name;
    setForm((current) => ({
      ...current,
      name: current.name || (typeof name === "string" ? name : ""),
      email: current.email || user.email || "",
      contact:
        current.contact ||
        (user.phone ? `+${user.phone.replace(/^\+/, "")}` : ""),
    }));
  }, [user]);

  useEffect(() => {
    async function loadStates() {
      setStatesLoading(true);
      setLocationError("");

      try {
        const response = await fetch("/api/locations/states", {
          method: "GET",
        });

        const result = (await response.json()) as StatesApiResponse;

        if (!response.ok || result.error) {
          throw new Error(result.error || "Unable to load states.");
        }

        setStates(result.states ?? []);
      } catch (err) {
        console.error(err);
        setStates([]);
        setLocationError(
          "State list could not be loaded. Please refresh the page.",
        );
      } finally {
        setStatesLoading(false);
      }
    }

    loadStates();
  }, []);

  useEffect(() => {
    async function loadCities() {
      if (!form.state) {
        setCities([]);
        return;
      }

      setCitiesLoading(true);
      setLocationError("");

      try {
        const response = await fetch(
          `/api/locations/cities?state=${encodeURIComponent(form.state)}`,
          {
            method: "GET",
          },
        );

        const result = (await response.json()) as CitiesApiResponse;

        if (!response.ok || result.error) {
          throw new Error(result.error || "Unable to load cities.");
        }

        setCities(result.cities ?? []);

        if (!result.cities?.length) {
          setManualCityMode(true);
          setLocationError(
            "City list is not available for this state. Please enter city manually.",
          );
        }
      } catch (err) {
        console.error(err);
        setCities([]);
        setManualCityMode(true);
        setLocationError(
          "City list could not be loaded. Please enter city manually.",
        );
      } finally {
        setCitiesLoading(false);
      }
    }

    loadCities();
  }, [form.state]);

  function formatPrice(value: number) {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  }

  function updateField<K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K],
  ) {
    if (loading) return;
    if (key === "pincode") {
      const pincode = value.replace(/\D/g, "").slice(0, 6);
      pincodeEdited.current = true;
      setDeliveryPincode(pincode);
      setForm((current) => ({ ...current, pincode }));
      return;
    }
    if (["addressLine1", "addressLine2", "city", "state", "country"].includes(key) && form[key] !== value && shippingSelection.service === "quick") {
      setShippingSelection({ service: "quick" });
    }
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleStateChange(value: string) {
    if (loading) return;
    if (form.state !== value && shippingSelection.service === "quick") setShippingSelection({ service: "quick" });
    setForm((prev) => ({
      ...prev,
      state: value,
      city: "",
    }));

    setCities([]);
    setManualCityMode(false);
    setLocationError("");
  }

  function validateForm() {
    if (!form.name.trim()) return "Please enter customer name.";
    if (!form.contact.trim()) return "Please enter mobile number.";
    if (!form.email.trim()) return "Please enter email address.";
    if (!form.addressLine1.trim()) return "Please enter address line 1.";
    if (!form.state.trim()) return "Please select state.";
    if (!form.city.trim()) return "Please select city.";
    if (!isValidIndianPincode(form.pincode)) return "Please enter a valid six-digit Indian PIN code.";
    if (form.country !== "India") return "Online delivery is currently available within India.";
    if (shipping.locationRequired) return "Pin and confirm your delivery location for Shiprocket Quick.";
    return "";
  }

  function handlePayment() {
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!shipping.quote || shipping.quote.expiresAt <= Date.now()) {
      setError("Please wait for a current shipping estimate before paying.");
      shipping.refresh();
      return;
    }

    startCheckout({
      expectedAmountPaise: shipping.quote.totalPaise,
      expectedShippingAmountPaise: shipping.quote.amountPaise,
      service: shippingSelection.service,
      deliveryLocation: shippingSelection.service === "quick" ? shippingSelection.deliveryLocation : undefined,
      items: items.map((item) => ({
        itemCode: item.itemCode,
        slug: item.slug,
        quantity: item.quantity,
      })),
      customer: {
        name: form.name.trim(),
        email: form.email.trim(),
        contact: form.contact.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        country: form.country.trim(),
        notes: form.notes.trim(),
      },
      onSuccess: ({ paymentId, websiteOrderId, paymentPending, trackingToken }) => {
        clearCart();
        const params = new URLSearchParams({ payment_id: paymentId });
        if (websiteOrderId) params.set("order_id", websiteOrderId);
        if (paymentPending) params.set("pending", "1");
        // A fragment keeps the private tracking capability out of HTTP request URLs.
        const privateLink = websiteOrderId && trackingToken ? `#token=${encodeURIComponent(trackingToken)}` : "";
        router.push(`/checkout/success?${params}${privateLink}`);
      },
      onError: (message) => setError(message),
      onQuoteChanged: shipping.refresh,
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <section className="rounded-3xl border border-gold/20 bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="font-serif text-3xl font-semibold text-maroon">
            Checkout
          </h1>

          <p className="mt-3 text-ink-mid">
            Your cart is empty. Please add products before checkout.
          </p>

          <Link
            href="/cart"
            className="mt-6 inline-flex rounded-full bg-maroon px-6 py-3 text-base font-semibold text-white transition hover:bg-maroon-dark"
          >
            Back to Cart
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:py-10">
      <Link
        href="/cart"
        className="text-base font-medium text-maroon transition hover:text-maroon-dark"
      >
        ← Back to Cart
      </Link>

      <div className="mt-6">
        <h1 className="font-serif text-3xl font-semibold text-maroon sm:text-4xl">
          Checkout Details
        </h1>

        <p className="mt-2 text-ink-mid">
          Fill customer contact and address details before payment.
        </p>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm md:p-7">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Customer Contact & Address
          </h2>

          <p className="mt-2 text-base text-ink-mid">
            We use these details to confirm your order and arrange delivery.
          </p>

          {locationError && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-800">
              {locationError}
            </p>
          )}

          <fieldset disabled={loading} aria-busy={loading} className="min-w-0 border-0 p-0">
          <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-2">
            <label className="block text-base font-medium text-ink">
              Customer Name *
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Full name"
              />
            </label>

            <label className="block text-base font-medium text-ink">
              Mobile Number *
              <input
                value={form.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Mobile number"
              />
            </label>

            <label className="block text-base font-medium text-ink md:col-span-2">
              Email Address *
              <input
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Email address"
              />
            </label>

            <label className="block text-base font-medium text-ink md:col-span-2">
              Address Line 1 *
              <input
                value={form.addressLine1}
                onChange={(e) => updateField("addressLine1", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="House / Flat / Building / Street"
              />
            </label>

            <label className="block text-base font-medium text-ink md:col-span-2">
              Address Line 2
              <input
                value={form.addressLine2}
                onChange={(e) => updateField("addressLine2", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Area / Landmark"
              />
            </label>

            <label className="block text-base font-medium text-ink">
              State *
              <select
                value={form.state}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={statesLoading}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon disabled:cursor-not-allowed disabled:bg-cream/50 disabled:text-ink-mid"
              >
                <option value="">
                  {statesLoading ? "Loading states..." : "Select state"}
                </option>

                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <label className="block text-base font-medium text-ink">
                City *
                {!manualCityMode ? (
                  <select
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={!form.state || citiesLoading}
                    className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon disabled:cursor-not-allowed disabled:bg-cream/50 disabled:text-ink-mid"
                  >
                    <option value="">
                      {!form.state
                        ? "Select state first"
                        : citiesLoading
                          ? "Loading cities..."
                          : selectedStateHasCities
                            ? "Select city"
                            : "No cities found"}
                    </option>

                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                    placeholder="Enter city manually"
                  />
                )}
              </label>

              {form.state && (
                <button
                  type="button"
                  onClick={() => {
                    setManualCityMode((prev) => !prev);
                    updateField("city", "");
                  }}
                  className="mt-2 text-base font-medium text-maroon hover:text-maroon-dark"
                >
                  {manualCityMode ? "Choose city from dropdown" : ""}
                </button>
              )}
            </div>

            <label className="block text-base font-medium text-ink">
              PIN Code *
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                disabled={loading}
                value={form.pincode}
                onChange={(e) => updateField("pincode", e.target.value)}
                aria-describedby="checkout-pincode-help"
                aria-invalid={form.pincode.length === 6 && !shipping.validPincode || undefined}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="6-digit pincode"
              />
              <span id="checkout-pincode-help" className="mt-2 block text-sm font-normal text-ink-mid">
                Your cart pincode is filled here. Changing it updates shipping.
              </span>
            </label>

            <label className="block text-base font-medium text-ink">
              Country *
              <input
                value={form.country}
                readOnly
                autoComplete="country-name"
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Country"
              />
            </label>

            <label className="block text-base font-medium text-ink md:col-span-2">
              Order Notes
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-base outline-none transition focus:border-maroon"
                placeholder="Personalization, delivery instruction, or any special note"
              />
            </label>
          </div>
          <DeliveryServiceSelector
            selection={shippingSelection}
            onChange={setShippingSelection}
            pincode={form.pincode}
            disabled={loading}
            locationResetKey={JSON.stringify([form.addressLine1, form.addressLine2, form.city, form.state, form.country])}
          />
          </fieldset>
        </section>

        <aside className="h-fit min-w-0 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Order Summary
          </h2>

          <div className="mt-5 space-y-4">
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.slug}
                  className="flex min-w-0 justify-between gap-4 text-base"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">
                      {formatProductName(item.name, item.printName)}
                    </p>
                    <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-ink-mid">
                      <span>Qty: {item.quantity} ×</span>
                      <ProductPrice price={item.price} mrp={item.mrp} />
                    </p>
                  </div>

                  <p className="shrink-0 font-medium text-maroon">
                    ₹{formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gold/20 pt-4 text-base">
              <div className="flex min-w-0 justify-between gap-4">
                <span className="min-w-0 text-ink-mid">
                  Subtotal ({totalItems} items)
                </span>
                <span className="shrink-0 font-medium">
                  ₹{formatPrice(shipping.quote ? shipping.quote.subtotalPaise / 100 : totalPrice)}
                </span>
              </div>

              <div className="mt-3 flex justify-between gap-4">
                <span className="text-ink-mid">Shipping estimate</span>
                <span className="shrink-0 font-medium">
                  {shipping.quote ? `₹${formatPrice(shipping.quote.amountPaise / 100)}` : shipping.loading ? "Checking…" : "—"}
                </span>
              </div>

              <div role="status" aria-live="polite" className={`mt-3 text-sm ${shipping.error ? "text-red-700" : "text-ink-mid"}`}>
                {shipping.locationRequired && shipping.validPincode
                  ? "Pin and confirm the delivery location to calculate Quick shipping."
                  : shipping.loading
                  ? "Updating shipping for your delivery pincode…"
                  : shipping.error
                    ? shipping.error
                    : shipping.quote
                      ? `Delivery pincode: ${form.pincode}`
                      : "Enter a valid delivery pincode to calculate your total."}
                {shipping.error && (
                  <button type="button" onClick={shipping.refresh} className="ml-2 font-semibold text-maroon underline underline-offset-2">
                    Retry
                  </button>
                )}
              </div>

              <div className="mt-4 flex justify-between gap-4 border-t border-gold/20 pt-4 text-lg font-semibold text-maroon">
                <span>Total</span>
                <span className="shrink-0">{shipping.quote ? `₹${formatPrice(shipping.quote.totalPaise / 100)}` : "—"}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayment}
            disabled={loading || statesLoading || citiesLoading || !shipping.quote || shipping.loading}
            className="mt-6 w-full rounded-full bg-maroon px-5 py-3 text-base font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing…" : "Pay Now"}
          </button>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">
              {error}
            </p>
          )}

          <p className="mt-4 text-center text-sm text-ink-mid">
            Your order details are saved securely before payment.
          </p>
        </aside>
      </div>
    </main>
  );
}
