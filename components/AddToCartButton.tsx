"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import { useCart } from "./CartProvider";

interface AddToCartButtonProps {
  product: Product;
  /** Larger variant used on the product detail page */
  large?: boolean;
  variant?: "default" | "card";
}

/**
 * Adds a product to the cart and shows a brief confirmation.
 * Reads the cart via the useCart hook.
 */
export default function AddToCartButton({
  product,
  large = false,
  variant = "default",
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
    "w-full font-semibold uppercase tracking-[0.08em] transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-carbon focus:ring-offset-2 min-[400px]:tracking-[0.13em]";
  const size = large
    ? "py-4 text-[12.5px]"
    : "py-2.5 text-[10px] min-[400px]:py-3 sm:text-[11px]";
  const colors = added
    ? "border border-carbon bg-carbon text-white"
    : "border border-carbon bg-white text-carbon hover:bg-carbon hover:text-white";
  const isCard = variant === "card";
  const buttonClassName = isCard
    ? `flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors duration-[240ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 motion-reduce:transition-none sm:text-[13px] ${added ? "border-carbon bg-carbon text-white" : "border-[#e6d4d5] bg-[#fbf5f5] text-carbon hover:border-carbon hover:bg-carbon hover:text-white"}`
    : `${base} ${size} ${colors}`;

  if (!Number.isFinite(product.price) || product.price <= 0) {
    return (
      <Link
        href={`/contact?product=${encodeURIComponent(product.slug)}`}
        className={`${isCard ? "" : "block"} text-center ${buttonClassName}`}
      >
        {isCard ? "Enquire for price" : "Price on request"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={buttonClassName}
      aria-label={`Add ${product.name} to cart`}
    >
      {isCard && (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          {added ? <path d="m5 12 4 4L19 6" /> : <><path d="M6 7h12l1 13H5L6 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>}
        </svg>
      )}
      <span role="status">{added ? (isCard ? "Added to cart" : "\u2713 Added to Cart") : "Add to Cart"}</span>
    </button>
  );
}
