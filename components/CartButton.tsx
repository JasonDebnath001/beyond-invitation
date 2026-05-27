"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

/** Navbar cart button — shows the live item count from the cart context. */
export default function CartButton() {
  const { totalItems } = useCart();

  return (
    <Link
      href="/cart"
      className="flex items-center gap-1.5 rounded-lg bg-maroon px-4 py-2 text-[13px] font-medium text-gold-light transition hover:bg-maroon-dark"
    >
      🛒 Cart ({totalItems})
    </Link>
  );
}