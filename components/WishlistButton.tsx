"use client";

import { MAX_WISHLIST_ITEMS } from "@/lib/wishlist";
import { useWishlist } from "./WishlistProvider";

type WishlistButtonProps = { productSlug: string; className?: string };

export default function WishlistButton({ productSlug, className = "" }: WishlistButtonProps) {
  const { slugs, ready, syncing, toggleItem } = useWishlist();
  const wishlisted = slugs.includes(productSlug);
  const full = !wishlisted && slugs.length >= MAX_WISHLIST_ITEMS;
  const label = !ready ? "Loading wishlist" : syncing ? "Saving wishlist" : full ? "Wishlist is full" : wishlisted ? "Remove from wishlist" : "Add to wishlist";

  return (
    <button
      type="button"
      onClick={() => toggleItem(productSlug)}
      disabled={!ready || syncing || full}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e9e1d7] bg-white/95 p-0 shadow-[0_2px_6px_rgba(42,24,16,0.04)] transition-colors duration-[240ms] hover:border-carbon/30 hover:bg-[#fbf5f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 disabled:opacity-60 motion-reduce:transition-none ${wishlisted ? "text-carbon" : "text-[#78695d]"} ${className}`}
      aria-label={label}
      aria-pressed={wishlisted}
      aria-busy={syncing}
      title={label}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
  );
}
