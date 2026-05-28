"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types";
import { useCart } from "./CartProvider";

interface AddToCartButtonProps {
  product: Product;
  /** Larger variant used on the product detail page */
  large?: boolean;
}

/**
 * Adds a product to the cart and shows a brief confirmation.
 * Reads the cart via the useCart hook.
 */
export default function AddToCartButton({
  product,
  large = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const addedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current) {
        clearTimeout(addedTimeoutRef.current);
      }
    };
  }, []);

  function handleClick() {
    addItem(product);
    setAdded(true);
    if (addedTimeoutRef.current) {
      clearTimeout(addedTimeoutRef.current);
    }
    addedTimeoutRef.current = window.setTimeout(() => {
      setAdded(false);
      addedTimeoutRef.current = null;
    }, 1500);
  }

  const base =
    "w-full font-semibold uppercase tracking-[0.13em] transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-carbon focus:ring-offset-2";
  const size = large ? "py-4 text-[12.5px]" : "py-3 text-[11px]";
  const colors = added
    ? "border border-carbon bg-carbon text-white"
    : "border border-carbon bg-white text-carbon hover:bg-carbon hover:text-white";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${size} ${colors}`}
    >
      {added ? "\u2713 Added to Cart" : "Add to Cart"}
    </button>
  );
}