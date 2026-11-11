"use client";

import { useState } from "react";
import Link from "next/link";
import ProductPrice from "@/components/ProductPrice";
import { formatProductName } from "@/lib/product-name";
import { useShippingQuote } from "@/components/useShippingQuote";
import DeliveryServiceSelector from "@/components/DeliveryServiceSelector";

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
    deliveryPincode,
    setDeliveryPincode,
    shippingSelection,
    setShippingSelection,
  } = useCart();
  // A saved pin is not enough to identify the full delivery address for this order.
  const quickAtCheckout = shippingSelection.service === "quick";
  const shipping = useShippingQuote(items, deliveryPincode, { service: shippingSelection.service });
  const [pincodeTouched, setPincodeTouched] = useState(false);
  const pincodeInvalid = pincodeTouched && !shipping.validPincode;

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

          <p className="mt-3 text-base text-ink-mid">
            Browse our collection and
            add some beautiful
            invitation cards.
          </p>

          <Link
            href="/collections/wedding"
            className="mt-8 inline-flex rounded-full bg-maroon px-6 py-3 text-base font-semibold text-white transition hover:bg-maroon-dark"
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

        <p className="mt-2 text-base text-ink-mid">
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
                    alt={formatProductName(item.name, item.printName)}
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
                    {formatProductName(item.name, item.printName)}
                  </h3>

                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base text-ink-mid">
                    <ProductPrice price={item.price} mrp={item.mrp} />
                    <span>/ pc</span>
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(
                        item.slug,
                      )
                    }
                    className="mt-4 text-base font-medium text-ink-mid underline-offset-2 hover:text-maroon hover:underline"
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

                    <span className="min-w-12 text-center text-base font-semibold">
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
            className="text-base font-medium text-ink-mid underline-offset-2 hover:text-maroon hover:underline"
          >
            Clear cart
          </button>
        </section>

        <aside className="h-fit min-w-0 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-2xl font-semibold text-maroon">
            Order Summary
          </h2>

          {!quickAtCheckout && <form
            className="mt-5 rounded-2xl border border-gold/20 bg-gold-pale/40 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPincodeTouched(true);
              if (shipping.validPincode) shipping.refresh();
            }}
          >
            <label htmlFor="cart-delivery-pincode" className="block text-sm font-semibold text-maroon">
              Delivery pincode
            </label>
            <div className="mt-2 flex min-w-0 gap-2">
              <input
                id="cart-delivery-pincode"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={deliveryPincode}
                onChange={(event) => setDeliveryPincode(event.target.value)}
                onBlur={() => setPincodeTouched(true)}
                aria-invalid={pincodeInvalid || undefined}
                aria-describedby="cart-shipping-status"
                placeholder="6-digit pincode"
                className="min-w-0 flex-1 rounded-xl border border-gold/30 bg-white px-3 py-2.5 text-base outline-none focus:border-maroon"
              />
              <button
                type="submit"
                disabled={shipping.loading}
                className="shrink-0 rounded-xl bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
              >
                {shipping.loading ? "Checking…" : shipping.error ? "Retry" : "Check"}
              </button>
            </div>
            <p
              id="cart-shipping-status"
              role="status"
              aria-live="polite"
              className={`mt-2 text-sm ${pincodeInvalid || shipping.error ? "text-red-700" : "text-ink-mid"}`}
            >
              {pincodeInvalid
                ? "Enter a valid six-digit Indian pincode."
                : shipping.locationRequired && shipping.validPincode
                  ? "Quick shipping is calculated from your full address at checkout."
                : shipping.loading
                  ? "Calculating shipping for your cart…"
                  : shipping.error
                    ? shipping.error
                    : shipping.quote
                      ? `Shipping is available to ${deliveryPincode}. Your pincode will carry over to checkout.`
                      : "Enter your pincode to see the shipping fee."}
            </p>
          </form>}

          <DeliveryServiceSelector selection={shippingSelection} onChange={setShippingSelection} />

          <div className="mt-5 space-y-3 text-base">
            <div className="flex min-w-0 justify-between gap-4">
              <span className="min-w-0 text-ink-mid">
                Subtotal (
                {totalItems} items)
              </span>

              <span className="shrink-0 font-medium">
                ₹
                {formatPrice(
                  shipping.quote ? shipping.quote.subtotalPaise / 100 : totalPrice,
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-ink-mid">
                Shipping estimate
              </span>

              <span className="text-right font-medium">
                {quickAtCheckout ? "Calculated at checkout" : shipping.quote ? `₹${formatPrice(shipping.quote.amountPaise / 100)}` : shipping.loading ? "Checking…" : "—"}
              </span>
            </div>

            <div className="flex justify-between gap-4 border-t border-gold/20 pt-4 text-lg font-semibold text-maroon">
              <span>Total</span>

              <span className="shrink-0">
                {shipping.quote ? `₹${formatPrice(shipping.quote.totalPaise / 100)}` : "—"}
              </span>
            </div>
          </div>
          {!shipping.quote && (
            <p className="mt-3 text-sm text-ink-mid">{quickAtCheckout ? "Continue to checkout and enter your full address to calculate Quick shipping and your total." : "Your total will include shipping once your delivery location is checked."}</p>
          )}

          <Link
            href="/checkout"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-maroon px-5 py-3 text-base font-semibold text-white transition hover:bg-maroon-dark"
          >
            Proceed to Checkout
          </Link>

          <Link
            href="/collections/wedding-card"
            className="mt-3 flex w-full items-center justify-center rounded-full border border-gold/30 px-5 py-3 text-base font-semibold text-maroon transition hover:bg-gold-pale"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
