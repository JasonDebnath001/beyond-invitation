"use client";

import { useState } from "react";
import Link from "next/link";

import {
  MIN_ORDER_QUANTITY,
  useCart,
  type CartItem,
} from "@/components/CartProvider";

export default function CartPage() {
  const {
    items,
    removeItem,
    setQuantity,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();

  const [failedImages, setFailedImages] =
    useState<Record<string, boolean>>({});

  function formatPrice(value: number) {
    return value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  }

  function decreaseQuantity(item: CartItem) {
    const nextQuantity =
      item.quantity - item.quantityStep;

    setQuantity(
      item.slug,
      Math.max(
        MIN_ORDER_QUANTITY,
        nextQuantity,
      ),
    );
  }

  function increaseQuantity(item: CartItem) {
    /*
     * Handles products that may have been added through an older
     * "Add to Cart" button with quantity 1.
     *
     * The first increase moves them to the minimum quantity of 50.
     */
    if (item.quantity < MIN_ORDER_QUANTITY) {
      setQuantity(
        item.slug,
        MIN_ORDER_QUANTITY,
      );

      return;
    }

    setQuantity(
      item.slug,
      item.quantity + item.quantityStep,
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-3xl border border-gold/20 bg-white p-10 text-center shadow-sm">
          <h1 className="font-serif text-3xl font-semibold text-maroon">
            Your cart is empty
          </h1>

          <p className="mt-3 text-sm text-ink-light">
            Browse our collection and add some
            beautiful invitation cards.
          </p>

          <Link
            href="/collections/wedding"
            className="mt-8 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
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
        <h1 className="font-serif text-4xl font-semibold text-maroon">
          Shopping Cart
        </h1>

        <p className="mt-2 text-sm text-ink-light">
          {totalItems}{" "}
          {totalItems === 1
            ? "item"
            : "items"}{" "}
          in your cart
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {items.map((item) => (
            <div
              key={item.slug}
              className="flex gap-4 rounded-3xl border border-gold/20 bg-white p-4 shadow-sm"
            >
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold-pale">
                {item.image &&
                !failedImages[item.slug] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={() => {
                      setFailedImages(
                        (previous) => ({
                          ...previous,
                          [item.slug]: true,
                        }),
                      );
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">
                    {item.emoji || ""}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-maroon">
                    {item.name}
                  </h3>

                  <p className="mt-1 text-sm text-ink-light">
                    ₹{formatPrice(item.price)} / pc
                  </p>

                  <p className="mt-1 text-xs text-ink-light">
                    Quantity changes by{" "}
                    {item.quantityStep}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(item.slug)
                    }
                    className="mt-4 text-sm font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex flex-col items-start gap-4 sm:items-end">
                  <div className="flex items-center rounded-full border border-gold/30 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        decreaseQuantity(item)
                      }
                      aria-label={`Decrease quantity by ${item.quantityStep}`}
                      disabled={
                        item.quantity <=
                        MIN_ORDER_QUANTITY
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full text-maroon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>

                    <span className="min-w-12 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        increaseQuantity(item)
                      }
                      aria-label={`Increase quantity by ${item.quantityStep}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-maroon transition hover:bg-gold-pale"
                    >
                      +
                    </button>
                  </div>

                  <p className="text-base font-semibold text-maroon">
                    ₹
                    {formatPrice(
                      item.price *
                        item.quantity,
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={clearCart}
            className="text-sm font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline"
          >
            Clear cart
          </button>
        </section>

        <aside className="h-fit rounded-3xl border border-gold/20 bg-white p-6 shadow-sm lg:sticky lg:top-24">
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
              <span className="text-ink-light">
                Shipping
              </span>

              <span className="font-medium">
                Free
              </span>
            </div>

            <div className="flex justify-between border-t border-gold/20 pt-4 text-lg font-semibold text-maroon">
              <span>Total</span>

              <span>
                ₹{formatPrice(totalPrice)}
              </span>
            </div>
          </div>

          <Link
            href="/checkout"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/collections/wedding"
            className="mt-3 flex w-full items-center justify-center rounded-full border border-gold/30 px-5 py-3 text-sm font-semibold text-maroon transition hover:bg-gold-pale"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}