"use client";

import { useState } from "react";
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

  function handleClick() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const base =
    "w-full rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-gold";
  const size = large ? "py-3 text-sm" : "py-2.5 text-[13px]";
  const colors = added
    ? "border border-maroon bg-maroon text-gold-light"
    : "border border-gold/25 bg-gold-pale text-maroon hover:border-maroon hover:bg-maroon hover:text-gold-light";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${size} ${colors}`}
    >
      {added ? "✓ Added to Cart!" : "Add to Cart"}
    </button>
  );
}