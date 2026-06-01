"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || user?.fullName || "",
      email: prev.email || user?.primaryEmailAddress?.emailAddress || "",
      contact: prev.contact || user?.primaryPhoneNumber?.phoneNumber || "",
    }));
  }, [user]);

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

  function validateForm() {
    if (!form.name.trim()) return "Please enter customer name.";
    if (!form.contact.trim()) return "Please enter mobile number.";
    if (!/^[0-9+\-\s()]{7,20}$/.test(form.contact.trim())) {
      return "Please enter a valid mobile number.";
    }
    if (!form.email.trim()) return "Please enter email address.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (!form.addressLine1.trim()) return "Please enter address line 1.";
    if (!form.city.trim()) return "Please enter city.";
    if (!form.state.trim()) return "Please enter state.";
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
        router.push(`/checkout/success?payment_id=${encodeURIComponent(paymentId)}`);
      },

      onError: (message) => {
        setError(message);
      },
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-3xl border border-gold/20 bg-white p-10 text-center shadow-sm">
          <h1 className="font-serif text-3xl font-semibold text-maroon">
            Checkout
          </h1>

          <p className="mt-3 text-sm text-ink-light">
            Your cart is empty. Please add products before checkout.
          </p>

          <Link
            href="/cart"
            className="mt-8 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Back to Cart
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/cart"
        className="mb-6 inline-flex text-sm font-medium text-maroon underline-offset-2 hover:underline"
      >
        ← Back to Cart
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-4xl font-semibold text-maroon">
          Checkout Details
        </h1>

        <p className="mt-2 text-sm text-ink-light">
          Fill customer contact and address details before payment.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-gold/20 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Customer Contact & Address
          </h2>

          <p className="mt-2 text-sm text-ink-light">
            These details will be sent to Razorpay and saved with the ERPNext order.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink">
                Customer Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={form.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Mobile number"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-ink">
                Email Address *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Email address"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-ink">
                Address Line 1 *
              </label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => updateField("addressLine1", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="House / Flat / Building / Street"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-ink">
                Address Line 2
              </label>
              <input
                type="text"
                value={form.addressLine2}
                onChange={(e) => updateField("addressLine2", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Area / Landmark"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">City *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="City"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">State *</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => updateField("state", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="State"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">PIN Code *</label>
              <input
                type="text"
                value={form.pincode}
                onChange={(e) => updateField("pincode", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="PIN code"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">Country *</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Country"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-ink">
                Order Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-4 py-3 text-sm outline-none transition focus:border-maroon"
                placeholder="Personalization, delivery instruction, or any special note"
              />
            </div>
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
            disabled={loading}
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
            Razorpay will open only after customer details are filled.
          </p>
        </aside>
      </div>
    </main>
  );
}