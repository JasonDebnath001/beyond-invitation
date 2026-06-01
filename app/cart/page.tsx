"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartProvider";
import { useRazorpayCheckout } from "@/components/useRazorpayCheckout";

export default function CartPage() {
  const { items, removeItem, setQuantity, clearCart, totalItems, totalPrice } =
    useCart();
  const { user } = useUser();
  const router = useRouter();
  const { startCheckout, loading } = useRazorpayCheckout();

  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  function formatPrice(value: number) {
    return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

 function handleCheckout() {
    setError("");
    startCheckout({
      items: items.map((i) => ({
        itemCode: i.itemCode,
        slug: i.slug,
        quantity: i.quantity,
      })),
      customer: {
        name: user?.fullName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        contact: user?.primaryPhoneNumber?.phoneNumber ?? undefined,
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
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="text-6xl">🛒</div>
        <h1 className="mt-4 font-display text-3xl font-semibold text-maroon-dark">
          Your cart is empty
        </h1>
        <p className="mt-2 text-ink-mid">
          Browse our collection and add some beautiful invitation cards.
        </p>
        <Link
          href="/collections/wedding"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-maroon px-7 py-3 text-sm font-semibold text-gold-light transition hover:bg-maroon-dark"
        >
          Explore Wedding Cards →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="mb-8 font-display text-3xl font-semibold text-maroon-dark">
        Shopping Cart
        <span className="ml-3 text-base font-normal text-ink-light">
          ({totalItems} {totalItems === 1 ? "item" : "items"})
        </span>
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Item list */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.slug}
              className="flex gap-4 rounded-xl border border-gold/25 bg-white p-4"
            >
              <Link
                href={`/products/${item.slug}`}
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gold-pale text-3xl"
              >
                {item.image && !failed[item.slug] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      item.image.startsWith("http")
                        ? item.image
                        : `/products/${item.image}`
                    }
                    alt={item.name}
                    onError={() =>
                      setFailed((f) => ({ ...f, [item.slug]: true }))
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span aria-hidden>{item.emoji}</span>
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <Link
                  href={`/products/${item.slug}`}
                  className="text-[14px] font-medium leading-snug text-ink hover:text-maroon"
                >
                  {item.name}
                </Link>
                <span className="mt-1 font-display text-[16px] font-semibold text-maroon">
                  ₹{formatPrice(item.price)}
                </span>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (loading) return;
                        setQuantity(item.slug, item.quantity - 1);
                      }}
                      aria-label="Decrease quantity"
                      disabled={loading}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gold/30 text-maroon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-[14px] font-medium text-ink">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (loading) return;
                        setQuantity(item.slug, item.quantity + 1);
                      }}
                      aria-label="Increase quantity"
                      disabled={loading}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gold/30 text-maroon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[14px] font-semibold text-ink">
                      ₹{formatPrice(item.price * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (loading) return;
                        removeItem(item.slug);
                      }}
                      disabled={loading}
                      className="text-[12.5px] font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              if (loading) return;
              clearCart();
            }}
            disabled={loading}
            className="text-[13px] font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear cart
          </button>
        </div>

        {/* Order summary */}
        <div className="h-fit rounded-xl border border-gold/25 bg-white p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-maroon-dark">
            Order Summary
          </h2>

          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between text-ink-mid">
              <span>Subtotal ({totalItems} items)</span>
              <span>₹{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-ink-mid">
              <span>Shipping</span>
              <span className="text-[#27A060]">Free</span>
            </div>
          </div>

          <div className="my-4 h-px bg-gold/20" />

          <div className="flex justify-between text-[16px] font-semibold text-ink">
            <span>Total</span>
            <span className="font-display text-maroon">
              ₹{formatPrice(totalPrice)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-maroon py-3 text-sm font-semibold text-gold-light transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing…" : "Proceed to Checkout"}
          </button>

          {error && (
            <p className="mt-3 text-center text-[12.5px] text-red-600">
              {error}
            </p>
          )}

          <Link
            href="/collections/wedding"
            className="mt-3 block text-center text-[13px] font-medium text-maroon underline-offset-2 hover:underline"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}