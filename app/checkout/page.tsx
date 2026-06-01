"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartProvider";
import { useRazorpayCheckout } from "@/components/useRazorpayCheckout";

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
  const { items, totalItems, totalPrice, clearCart } = useCart();
  const { user } = useUser();
  const router = useRouter();
  const { startCheckout, loading } = useRazorpayCheckout();

  const [form, setForm] = useState<CheckoutForm>(initialForm);
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
    setForm((prev) => ({
      ...prev,
      name: prev.name || user?.fullName || "",
      email: prev.email || user?.primaryEmailAddress?.emailAddress || "",
      contact: prev.contact || user?.primaryPhoneNumber?.phoneNumber || "",
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
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleStateChange(value: string) {
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
    if (!form.pincode.trim()) return "Please enter PIN code.";
    if (!form.country.trim()) return "Please enter country.";
    return "";
  }

  function handlePayment() {
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    startCheckout({
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
      onSuccess: ({ paymentId }) => {
        clearCart();
        router.push(`/checkout/success?payment_id=${paymentId}`);
      },
      onError: (message) => setError(message),
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <section className="rounded-3xl border border-gold/20 bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-3xl font-semibold text-maroon">
            Checkout
          </h1>

          <p className="mt-3 text-ink-light">
            Your cart is empty. Please add products before checkout.
          </p>

          <Link
            href="/cart"
            className="mt-6 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Back to Cart
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/cart"
        className="text-sm font-medium text-maroon transition hover:text-maroon-dark"
      >
        ← Back to Cart
      </Link>

      <div className="mt-6">
        <h1 className="font-serif text-4xl font-semibold text-maroon">
          Checkout Details
        </h1>

        <p className="mt-2 text-ink-light">
          Fill customer contact and address details before payment.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm md:p-7">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Customer Contact & Address
          </h2>

          <p className="mt-2 text-sm text-ink-light">
            These details will be saved in ERPNext with the order.
          </p>

          {locationError && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {locationError}
            </p>
          )}

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium text-ink">
              Customer Name *
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Full name"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              Mobile Number *
              <input
                value={form.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Mobile number"
              />
            </label>

            <label className="block text-sm font-medium text-ink md:col-span-2">
              Email Address *
              <input
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Email address"
              />
            </label>

            <label className="block text-sm font-medium text-ink md:col-span-2">
              Address Line 1 *
              <input
                value={form.addressLine1}
                onChange={(e) => updateField("addressLine1", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="House / Flat / Building / Street"
              />
            </label>

            <label className="block text-sm font-medium text-ink md:col-span-2">
              Address Line 2
              <input
                value={form.addressLine2}
                onChange={(e) => updateField("addressLine2", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Area / Landmark"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              State *
              <select
                value={form.state}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={statesLoading}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon disabled:cursor-not-allowed disabled:bg-cream/50 disabled:text-ink-light"
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
              <label className="block text-sm font-medium text-ink">
                City *

                {!manualCityMode ? (
                  <select
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={!form.state || citiesLoading}
                    className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon disabled:cursor-not-allowed disabled:bg-cream/50 disabled:text-ink-light"
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
                    className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
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
                  className="mt-2 text-xs font-medium text-maroon hover:text-maroon-dark"
                >
                  {manualCityMode
                    ? "Choose city from dropdown"
                    : ""}
                </button>
              )}
            </div>

            <label className="block text-sm font-medium text-ink">
              PIN Code *
              <input
                value={form.pincode}
                onChange={(e) => updateField("pincode", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="PIN code"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              Country *
              <input
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Country"
              />
            </label>

            <label className="block text-sm font-medium text-ink md:col-span-2">
              Order Notes
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Personalization, delivery instruction, or any special note"
              />
            </label>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-gold/20 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Order Summary
          </h2>

          <div className="mt-5 space-y-4">
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.slug}
                  className="flex justify-between gap-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="text-ink-light">
                      Qty: {item.quantity} × ₹{formatPrice(item.price)}
                    </p>
                  </div>

                  <p className="shrink-0 font-medium text-maroon">
                    ₹{formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gold/20 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-light">
                  Subtotal ({totalItems} items)
                </span>
                <span className="font-medium">₹{formatPrice(totalPrice)}</span>
              </div>

              <div className="mt-3 flex justify-between">
                <span className="text-ink-light">Shipping</span>
                <span className="font-medium">Free</span>
              </div>

              <div className="mt-4 flex justify-between border-t border-gold/20 pt-4 text-lg font-semibold text-maroon">
                <span>Total</span>
                <span>₹{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayment}
            disabled={loading || statesLoading || citiesLoading}
            className="mt-6 w-full rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing…" : "Pay Now"}
          </button>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-ink-light">
            Your order will be created in ERPNext before payment verification.
          </p>
        </aside>
      </div>
    </main>
  );
}