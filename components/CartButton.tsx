"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export default function CartButton() {
  const { totalItems } = useCart();

  const displayCount = totalItems > 99 ? "99+" : String(totalItems);

  return (
    <Link
      href="/cart"
      aria-label={`Cart${totalItems > 0 ? `, ${totalItems} items` : ""}`}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-carbon/10 bg-white text-carbon shadow-sm transition hover:border-carbon/25 hover:bg-paper focus:outline-none focus:ring-2 focus:ring-carbon/15"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 7h15l-1.5 9h-12z" />
        <path d="M6 7 5.4 4H3" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>

      {totalItems > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-carbon px-1.5 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
          {displayCount}
        </span>
      )}
    </Link>
  );
}