"use client";

import { useEffect, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";

type WishlistButtonProps = {
  productSlug: string;
  className?: string;
};

type WishlistApiItem = {
  product_slug?: string;
};

type WishlistApiResponse = {
  success?: boolean;
  items?: WishlistApiItem[];
  count?: number;
  error?: string;
  details?: string;
  added?: boolean;
  removed?: boolean;
  wishlistRecordName?: string;
};

async function readApiResponse(res: Response) {
  const rawText = await res.text();

  let data: WishlistApiResponse | null = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  return {
    rawText,
    data,
  };
}

export default function WishlistButton({
  productSlug,
  className = "",
}: WishlistButtonProps) {
  const { isSignedIn, isLoaded } = useAuth();

  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setChecking(false);
      setWishlisted(false);
      return;
    }

    async function checkWishlist() {
      try {
        setChecking(true);

        const res = await fetch("/api/wishlist", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const { rawText, data } = await readApiResponse(res);

        if (!res.ok) {
          console.error("Wishlist check failed:", {
            status: res.status,
            statusText: res.statusText,
            rawText,
            data,
          });
          return;
        }

        const found = Boolean(
          data?.items?.some((item) => item.product_slug === productSlug),
        );

        setWishlisted(found);
      } catch (error) {
        console.error("Wishlist check exception:", error);
      } finally {
        setChecking(false);
      }
    }

    checkWishlist();
  }, [isLoaded, isSignedIn, productSlug]);

  async function toggleWishlist() {
    if (!isSignedIn || loading) return;

    try {
      setLoading(true);

      const method = wishlisted ? "DELETE" : "POST";

      const res = await fetch("/api/wishlist", {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
        }),
      });

      const { rawText, data } = await readApiResponse(res);

      if (!res.ok) {
        console.error("Wishlist API failed:", {
          status: res.status,
          statusText: res.statusText,
          rawText,
          data,
        });

        alert(
          data?.details ||
            data?.error ||
            rawText ||
            `Wishlist failed with status ${res.status}`,
        );

        return;
      }

      setWishlisted((current) => !current);
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch (error) {
      console.error("Wishlist toggle exception:", error);
      alert("Could not update wishlist. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded || checking) {
    return (
      <button
        type="button"
        disabled
        className={`rounded-full border bg-white/90 px-3 py-2 text-sm text-gray-400 shadow-sm ${className}`}
        aria-label="Loading wishlist"
        title="Loading wishlist"
      >
        ♡
      </button>
    );
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className={`rounded-full border bg-white/90 px-3 py-2 text-sm text-gray-700 shadow-sm transition hover:bg-white ${className}`}
          aria-label="Sign in to add wishlist"
          title="Sign in to add wishlist"
        >
          ♡
        </button>
      </SignInButton>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      disabled={loading}
      className={`rounded-full border bg-white/90 px-3 py-2 text-sm shadow-sm transition hover:bg-white disabled:opacity-60 ${
        wishlisted ? "text-red-600" : "text-gray-700"
      } ${className}`}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {loading ? "…" : wishlisted ? "♥" : "♡"}
    </button>
  );
}