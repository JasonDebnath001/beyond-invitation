"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { useWishlist } from "@/components/WishlistProvider";
import type { Product } from "@/types";

export default function WishlistPage() {
  const { slugs, ready, syncing, signedIn, error: syncError, retry: retrySync, removeItem } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!slugs.length) {
      setProducts([]);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");

    async function loadProducts() {
      try {
        const response = await fetch("/api/wishlist/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs }),
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load saved products.");
        if (!controller.signal.aborted) setProducts(data.products);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load saved products.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadProducts();
    return () => controller.abort();
  }, [ready, slugs, retry]);

  const visibleProducts = products.filter((product) => slugs.includes(product.slug));
  const missingSlugs = slugs.filter((slug) => !products.some((product) => product.slug === slug));

  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">My Wishlist</h1>
        <p className="mt-2 text-gray-600">
          {signedIn ? "Your favourites, saved to your account." : "Your favourites, saved on this device."}
        </p>
        {!signedIn && ready && (
          <Link href="/sign-in?next=%2Fwishlist" className="mt-2 inline-block underline">Sign in to save your wishlist across devices</Link>
        )}
      </div>
      {!ready && syncError ? (
        <div role="alert">
          <p>We could not load your saved wishlist.</p>
          <button type="button" onClick={retrySync} disabled={syncing} className="mt-3 underline">Try again</button>
        </div>
      ) : !ready || loading ? <p role="status">Loading your wishlist…</p> : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 underline">Try again</button>
        </div>
      ) : slugs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="text-xl font-medium">Your wishlist is empty</h2>
          <p className="mt-2 text-gray-600">Tap the heart on a product to save it for later.</p>
          <Link href="/catalog" className="mt-5 inline-block underline">Browse products</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
          </div>
          {missingSlugs.map((slug) => (
            <div key={slug} className="mt-4 rounded-2xl border p-5">
              <p>Product {slug} is no longer available.</p>
              <button type="button" disabled={syncing} className="mt-2 underline disabled:opacity-50" onClick={() => removeItem(slug)}>Remove from wishlist</button>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
