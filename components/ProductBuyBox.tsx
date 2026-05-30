"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import { useCart } from "./CartProvider";

const MIN_QTY = 50;
const QTY_STEP = 25;

export default function ProductBuyBox({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();

  const [qty, setQty] = useState(MIN_QTY);
  const [added, setAdded] = useState(false);
  const timeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  function addToCart() {
    for (let i = 0; i < qty; i++) {
      addItem(product);
    }
  }

  function handleAdd() {
    addToCart();
    setAdded(true);

    if (timeout.current) clearTimeout(timeout.current);

    timeout.current = window.setTimeout(() => {
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
      <p className="mb-2 text-sm font-semibold text-carbon">Quantity</p>

      <div className="mb-6 flex w-fit items-center overflow-hidden rounded-full border border-gold/40 bg-white">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(MIN_QTY, q - QTY_STEP))}
          aria-label="Decrease quantity"
          disabled={qty <= MIN_QTY}
          className="flex h-10 w-10 items-center justify-center text-lg text-carbon transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <span className="w-16 text-center text-sm font-semibold">{qty}</span>

        <button
          type="button"
          onClick={() => setQty((q) => q + QTY_STEP)}
          aria-label="Increase quantity"
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