"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function WishlistNavLink() {
  const { isSignedIn, isLoaded } = useAuth();
  const [count, setCount] = useState(0);

  async function fetchCount() {
    if (!isLoaded || !isSignedIn) {
      setCount(0);
      return;
    }

    try {
      const res = await fetch("/api/wishlist", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) return;

      const data = await res.json();
      setCount(Number(data.count || 0));
    } catch (error) {
      console.error("Wishlist count failed:", error);
    }
  }

  useEffect(() => {
    fetchCount();

    function handleUpdate() {
      fetchCount();
    }

    window.addEventListener("wishlist-updated", handleUpdate);

    return () => {
      window.removeEventListener("wishlist-updated", handleUpdate);
    };
  }, [isLoaded, isSignedIn]);

  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist${count > 0 ? `, ${count} items` : ""}`}
      className="relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-carbon/10 bg-white px-3 text-[13px] font-bold text-carbon shadow-sm transition hover:border-carbon/25 hover:bg-paper focus:outline-none focus:ring-2 focus:ring-carbon/15 sm:px-4"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5 h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>

      <span className="hidden sm:inline">Wishlist</span>

      {count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-carbon px-1.5 text-[10px] font-extrabold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}