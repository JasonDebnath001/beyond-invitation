"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartProvider";
import { useRazorpayCheckout } from "@/components/useRazorpayCheckout";

export default function CartPage() {
  const {
    items,
    removeItem,
    setQuantity,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();

  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const { startCheckout, loading } = useRazorpayCheckout();

  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  function formatPrice(value: number) {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  }

  function handleCheckout() {
    setError("");

    if (!isSignedIn) {
      setError("Please sign in before placing your order.");
      return;
    }

    startCheckout({
      items: items.map((item) => ({
        itemCode: item.itemCode,
        slug: item.slug,
        quantity: item.quantity,
      })),
      onSuccess: ({ paymentId }) => {
        clearCart();
        router.push(`/checkout/success?payment_id=${paymentId}`);
      },
      onError: (message) => setError(message),
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-[2rem] border border-gold/20 bg-cream/70 p-8 text-center shadow-soft">
          <h1 className="font-serif text-3xl text-maroon">
            Your cart is empty
          </h1>

          <p className="mt-3 text-sm text-ink-light">
            Browse our collection and add some beautiful invitation cards.
          </p>

          <Link
            href="/collections/wedding"
            className="mt-6 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Explore Wedding Cards →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-maroon">
          Shopping Cart
        </h1>

        <p className="mt-1 text-sm text-ink-light">
          {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Cart items */}
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={item.slug}
              className="grid gap-4 rounded-[1.5rem] border border-gold/20 bg-white p-4 shadow-sm sm:grid-cols-[120px_1fr_auto]"
            >
              <div className="h-28 overflow-hidden rounded-2xl bg-gold-pale">
                {item.image && !failed[item.slug] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={() =>
                      setFailed((prev) => ({
                        ...prev,
                        [item.slug]: true,
                      }))
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">
                    {item.emoji}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-serif text-xl text-carbon">
                  {item.name}
                </h2>

                <p className="mt-1 text-sm text-ink-light">
                  ₹{formatPrice(item.price)} per piece
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (loading) return;
                    removeItem(item.slug);
                  }}
                  disabled={loading}
                  className="mt-4 text-[12.5px] font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="flex items-center overflow-hidden rounded-xl border border-gold/30">
                  <button
                    type="button"
                    onClick={() => {
                      if (loading) return;
                      setQuantity(item.slug, item.quantity - 1);
                    }}
                    aria-label="Decrease quantity"
                    disabled={loading}
                    className="flex h-9 w-9 items-center justify-center text-maroon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    −
                  </button>

                  <span className="min-w-12 text-center text-sm font-semibold text-carbon">
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
                    className="flex h-9 w-9 items-center justify-center text-maroon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    +
                  </button>
                </div>

                <p className="font-semibold text-maroon">
                  ₹{formatPrice(item.price * item.quantity)}
                </p>
              </div>
            </article>
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
        </section>

        {/* Order summary */}
        <aside className="h-fit rounded-[1.75rem] border border-gold/25 bg-cream/80 p-6 shadow-soft">
          <h2 className="font-serif text-2xl text-maroon">
            Order Summary
          </h2>

          <div className="mt-5 space-y-3 border-b border-gold/20 pb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-light">
                Subtotal ({totalItems} items)
              </span>
              <span className="font-medium text-carbon">
                ₹{formatPrice(totalPrice)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ink-light">Shipping</span>
              <span className="font-medium text-carbon">Free</span>
            </div>
          </div>

          <div className="mt-5 flex justify-between text-lg font-semibold text-maroon">
            <span>Total</span>
            <span>₹{formatPrice(totalPrice)}</span>
          </div>

          {!isLoaded ? (
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-full bg-maroon/60 px-5 py-3 text-sm font-semibold text-white"
            >
              Checking account…
            </button>
          ) : isSignedIn ? (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className="mt-6 w-full rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Processing…" : "Proceed to Checkout"}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                className="mt-6 w-full rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
              >
                Sign in to Checkout
              </button>
            </SignInButton>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {!isSignedIn && isLoaded && (
            <p className="mt-3 text-center text-xs text-ink-light">
              You can browse and add items freely, but sign-in is required before placing an order.
            </p>
          )}

          <Link
            href="/collections/wedding"
            className="mt-4 inline-flex w-full justify-center rounded-full border border-gold/40 px-5 py-3 text-sm font-semibold text-maroon transition hover:bg-gold-pale"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}