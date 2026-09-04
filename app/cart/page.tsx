"use client";

import { useState } from "react";
import Link from "next/link";

import {
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

  const [
    failedImages,
    setFailedImages,
  ] = useState<
    Record<string, boolean>
  >({});

  function formatPrice(
    value: number,
  ) {
    return value.toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      },
    );
  }

  function decreaseQuantity(
    item: CartItem,
  ) {
    const nextQuantity =
      item.quantity -
      item.quantityStep;

    setQuantity(
      item.slug,
      Math.max(
        item.minimumQuantity,
        nextQuantity,
      ),
    );
  }

  function increaseQuantity(
    item: CartItem,
  ) {
    setQuantity(
      item.slug,
      item.quantity +
        item.quantityStep,
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="rounded-3xl border border-gold/20 bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="font-serif text-3xl font-semibold text-maroon">
            Your cart is empty
          </h1>

          <p className="mt-3 text-sm text-ink-light">
            Browse our collection and
            add some beautiful
            invitation cards.
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
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-maroon sm:text-4xl">
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

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-8">
        <section className="min-w-0 space-y-4">
          {items.map((item) => (
            <div
              key={item.slug}
              className="flex min-w-0 flex-col gap-4 rounded-3xl border border-gold/20 bg-white p-4 shadow-sm min-[420px]:flex-row"
            >
              <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold-pale min-[420px]:h-24 min-[420px]:w-24">
                {item.image &&
                !failedImages[
                  item.slug
                ] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={() => {
                      setFailedImages(
                        (previous) => ({
                          ...previous,
                          [item.slug]:
                            true,
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

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <h3 className="break-words font-serif text-xl font-semibold text-maroon">
                    {item.name}
                  </h3>

                  <p className="mt-1 text-sm text-ink-light">
                    ₹
                    {formatPrice(
                      item.price,
                    )}{" "}
                    / pc
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(
                        item.slug,
                      )
                    }
                    className="mt-4 text-sm font-medium text-ink-light underline-offset-2 hover:text-maroon hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
                  <div className="flex items-center rounded-full border border-gold/30 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        decreaseQuantity(
                          item,
                        )
                      }
                      aria-label={`Decrease quantity by ${item.quantityStep}`}
                      disabled={
                        item.quantity <=
                        item.minimumQuantity
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
                        increaseQuantity(
                          item,
                        )
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

        <aside className="h-fit min-w-0 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Order Summary
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex min-w-0 justify-between gap-4">
              <span className="min-w-0 text-ink-light">
                Subtotal (
                {totalItems} items)
              </span>

              <span className="shrink-0 font-medium">
                ₹
                {formatPrice(
                  totalPrice,
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-ink-light">
                Shipping
              </span>

              <span className="shrink-0 font-medium">
                Free
              </span>
            </div>

            <div className="flex justify-between gap-4 border-t border-gold/20 pt-4 text-lg font-semibold text-maroon">
              <span>Total</span>

              <span className="shrink-0">
                ₹
                {formatPrice(
                  totalPrice,
                )}
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
            href="/collections/wedding-card"
            className="mt-3 flex w-full items-center justify-center rounded-full border border-gold/30 px-5 py-3 text-sm font-semibold text-maroon transition hover:bg-gold-pale"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
