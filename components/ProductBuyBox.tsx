"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import type { Product } from "@/types";

import {
  getQuantityStepFromSubject,
  MIN_QTY,
  useCart,
} from "./CartProvider";

type ProductBuyBoxProduct = Product & {
  itemCode?: string;
  subject?: string;
};

export default function ProductBuyBox({
  product,
}: {
  product: ProductBuyBoxProduct;
}) {
  const { addItem } = useCart();
  const router = useRouter();

  /**
   * Subject = Shagun Envelopes → 50
   * Hindu/Muslim/Christian/anything else → 25
   */
  const quantityStep =
    getQuantityStepFromSubject(
      product.subject,
    );

  const [qty, setQty] =
    useState(MIN_QTY);

  const [added, setAdded] =
    useState(false);

  const timeout =
    useRef<number | null>(null);

  /**
   * Reset the quantity when moving from one
   * product page to another.
   */
  useEffect(() => {
    setQty(MIN_QTY);
  }, [product.slug]);

  useEffect(() => {
    return () => {
      if (timeout.current !== null) {
        window.clearTimeout(
          timeout.current,
        );
      }
    };
  }, []);

  function decreaseQuantity() {
    setQty((currentQuantity) =>
      Math.max(
        MIN_QTY,
        currentQuantity -
          quantityStep,
      ),
    );
  }

  function increaseQuantity() {
    setQty(
      (currentQuantity) =>
        currentQuantity +
        quantityStep,
    );
  }

  function addToCart() {
    /**
     * Add the selected quantity in one dispatch.
     * Do not call addItem 50 or 100 times.
     */
    addItem(product, qty);
  }

  function handleAdd() {
    addToCart();
    setAdded(true);

    if (timeout.current !== null) {
      window.clearTimeout(
        timeout.current,
      );
    }

    timeout.current =
      window.setTimeout(() => {
        setAdded(false);
        timeout.current = null;
      }, 1600);
  }

  function handleBuyNow() {
    addToCart();
    router.push("/cart");
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-carbon">
        Quantity
      </p>

      <div className="mb-6 flex w-fit items-center overflow-hidden rounded-full border border-gold/40 bg-white">
        <button
          type="button"
          onClick={decreaseQuantity}
          aria-label={`Decrease quantity by ${quantityStep}`}
          disabled={qty <= MIN_QTY}
          className="flex h-10 w-10 items-center justify-center text-lg text-carbon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <span className="w-16 text-center text-sm font-semibold">
          {qty}
        </span>

        <button
          type="button"
          onClick={increaseQuantity}
          aria-label={`Increase quantity by ${quantityStep}`}
          className="flex h-10 w-10 items-center justify-center text-lg text-carbon transition hover:bg-gold-pale"
        >
          ＋
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full bg-carbon px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-gold hover:text-carbon"
        >
          {added
            ? "✓ Added to Cart"
            : "Add to Cart"}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          className="rounded-full border border-gold px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-carbon transition hover:bg-gold"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}