"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import { useCart } from "./CartProvider";

export default function ProductBuyBox({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const timeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  function addToCart() {
    for (let i = 0; i < qty; i++) addItem(product);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-light">
          Quantity
        </span>
        <div className="flex items-center rounded-lg border border-gold/30">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            disabled={qty <= 1}
            className="flex h-10 w-10 items-center justify-center text-lg text-carbon transition hover:bg-gold-pale disabled:opacity-40"
          >
            −
          </button>
          <span className="w-10 text-center text-[15px] font-semibold text-ink">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            aria-label="Increase quantity"
            className="flex h-10 w-10 items-center justify-center text-lg text-carbon transition hover:bg-gold-pale"
          >
            ＋
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleAdd}
          className={`flex-1 border py-4 text-[12.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/60 ${
            added
              ? "border-carbon bg-carbon text-gold-light"
              : "border-carbon bg-white text-carbon hover:bg-carbon hover:text-gold-light"
          }`}
        >
          {added ? "✓ Added to Cart" : "Add to Cart"}
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          className="flex-1 bg-carbon py-4 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-gold-light transition-colors duration-200 hover:bg-carbon-dark focus:outline-none focus:ring-2 focus:ring-gold/60"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}