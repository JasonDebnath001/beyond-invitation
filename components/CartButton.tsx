"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

/** Navbar cart button — shows the live item count from the cart context. */
export default function CartButton() {
  const { totalItems } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${totalItems} item${totalItems === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 items-center justify-center text-carbon transition-colors hover:bg-neutral-100"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {totalItems > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-carbon px-1 text-[9px] font-semibold leading-none text-white">
          {totalItems}
        </span>
      )}
    </Link>
  );
}