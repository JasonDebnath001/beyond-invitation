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
    <Link href="/wishlist" className="text-sm font-medium hover:text-gray-700">
      Wishlist{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}