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
    "w-full font-semibold tracking-normal transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-carbon focus:ring-offset-2";
  const size = large
    ? "py-4 text-base"
    : "py-2.5 text-base min-[400px]:py-3";
  const colors = added
    ? "border border-carbon bg-carbon text-white"
    : "border border-carbon bg-white text-carbon hover:bg-carbon hover:text-white";
  const isCard = variant === "card";
  const buttonClassName = isCard
    ? `flex min-h-11 w-full items-center justify-center whitespace-normal rounded-md px-2 py-2.5 text-base font-semibold leading-normal text-white transition-[background-color,transform,box-shadow] duration-200 ease-out hover:shadow-[0_4px_12px_rgba(112,39,35,0.16)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon motion-reduce:transform-none motion-reduce:transition-none sm:rounded-none sm:px-3 sm:py-2 sm:hover:-translate-y-0.5 sm:active:translate-y-0 ${added ? "bg-[#702723]" : "bg-[#96352f]/95 hover:bg-[#7e2a26]"}`
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
      <span role="status">
        {added
          ? isCard
            ? "Added to cart"
            : "\u2713 Added to Cart"
          : isCard
            ? "Add to cart"
            : "Add to Cart"}
      </span>
    </button>
  );
}
