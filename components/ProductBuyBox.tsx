"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Product } from "@/types";
import { useCart } from "./CartProvider";

const MIN_QTY = 50;
const WEDDING_CARD_QTY_STEP = 25;
const SHAGUN_ENVELOPE_QTY_STEP = 50;

type ProductWithItemGroup = Product & {
  itemGroup?: string;
};

function isShagunEnvelope(product: ProductWithItemGroup): boolean {
  const itemGroup = (product.itemGroup ?? "").trim().toLowerCase();

  // Preferred check for products coming from ERPNext.
  if (itemGroup) {
    return (
      itemGroup.includes("shagun") ||
      itemGroup.includes("sagun")
    );
  }

  // Fallback for local products or older product data.
  const productText = `${product.name} ${product.slug}`.toLowerCase();

  return (
    productText.includes("shagun") ||
    productText.includes("sagun")
  );
}

export default function ProductBuyBox({
  product,
}: {
  product: ProductWithItemGroup;
}) {
  const { addItem } = useCart();
  const router = useRouter();

  const quantityStep = isShagunEnvelope(product)
    ? SHAGUN_ENVELOPE_QTY_STEP
    : WEDDING_CARD_QTY_STEP;

  const [qty, setQty] = useState(MIN_QTY);
  const [added, setAdded] = useState(false);
  const timeout = useRef<number | null>(null);

  // Reset quantity when navigating between different products.
  useEffect(() => {
    setQty(MIN_QTY);
  }, [product.slug]);

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  function addToCart() {
    for (let i = 0; i < qty; i++) {
      addItem(product);
    }
  }

  function handleAdd() {
    addToCart();
    setAdded(true);

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = window.setTimeout(() => {
      setAdded(false);
      timeout.current = null;
    }, 1600);
  }

  function handleBuyNow() {
    addToCart();
    router.push("/cart");
  }

  function decreaseQuantity() {
    setQty((currentQty) =>
      Math.max(MIN_QTY, currentQty - quantityStep),
    );
  }

  function increaseQuantity() {
    setQty((currentQty) => currentQty + quantityStep);
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
          {added ? "✓ Added to Cart" : "Add to Cart"}
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