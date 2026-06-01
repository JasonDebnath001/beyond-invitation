"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const {
    items,
    removeItem,
    setQuantity,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();

  const [failed, setFailed] = useState<Record<string, boolean>>({});

  function formatPrice(value: number) {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl font-semibold text-maroon">
          Your cart is empty
        </h1>

        <p className="mt-3 text-ink-light">
          Browse our collection and add some beautiful invitation cards.
        </p>

        <Link
          href="/collections/wedding"
          className="mt-8 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
        >
          Explore Wedding Cards →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold text-maroon">
        Shopping Cart
      </h1>

      <p className="mt-1 text-sm text-ink-light">
        {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border border-gold/20 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.slug}
                className="grid grid-cols-[88px_1fr] gap-4 rounded-2xl border border-gold/15 bg-cream/30 p-3 sm:grid-cols-[104px_1fr_auto]"
              >
                <div className="h-24 w-22 overflow-hidden rounded-xl bg-gold-pale sm:h-28 sm:w-26">
                  {item.image && !failed[item.slug] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name}
                      onError={() =>
                        setFailed((f) => ({
                          ...f,
                          [item.slug]: true,
                        }))
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {item.emoji || "💌"}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-ink">{item.name}</h3>

                  <p className="mt-1 text-sm text-ink-light">
                    ₹{formatPrice(item.price)} / pc
                  </p>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(item.slug, item.quantity - 1)
                      }
                      aria-label="Decrease quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gold/30 text-maroon transition hover:bg-gold-pale"
                    >
                      −
                    </button>

                    <span className="min-w-10 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(item.slug, item.quantity + 1)
                      }
                      aria-label="Increase quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gold/30 text-maroon transition hover:bg-gold-pale"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-between border-t border-gold/10 pt-3 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                  <p className="font-semibold text-maroon">
                    ₹{formatPrice(item.price * item.quantity)}
                  </p>

                  <button
                    type="button"
                    onClick={() => removeItem(item.slug)}
                    className="mt-0 text-[12.5px] font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline sm:mt-4"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="mt-5 text-[13px] font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline"
          >
            Clear cart
          </button>
        </section>

        <aside className="h-fit rounded-3xl border border-gold/20 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Order Summary
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-light">
                Subtotal ({totalItems} items)
              </span>
              <span className="font-medium">
                ₹{formatPrice(totalPrice)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ink-light">Shipping</span>
              <span className="font-medium">Free</span>
            </div>

            <div className="border-t border-gold/20 pt-3">
              <div className="flex justify-between text-lg font-semibold text-maroon">
                <span>Total</span>
                <span>₹{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>

          <Link
            href="/checkout"
            className="mt-6 block w-full rounded-full bg-maroon px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/"
            className="mt-5 block text-center text-sm font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}