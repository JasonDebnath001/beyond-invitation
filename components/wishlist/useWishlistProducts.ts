"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types";

export function useWishlistProducts(slugs: string[], ready: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const resolved = useRef<{ slugs: Set<string>; attempt: number } | null>(null);
  const key = JSON.stringify(slugs);

  useEffect(() => {
    if (!ready) { resolved.current = null; setProducts([]); setError(""); setLoading(true); return; }
    const requested = JSON.parse(key) as string[];
    if (!requested.length) { setProducts([]); setError(""); setLoading(false); resolved.current = null; return; }
    // Keep the remaining cards mounted when removing or sorting, including optimistic rollback.
    if (resolved.current?.attempt === attempt && requested.every((slug) => resolved.current!.slugs.has(slug))) {
      setLoading(false); setError(""); return;
    }
    const controller = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/wishlist/products", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: requested }),
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load saved products.");
        if (!Array.isArray(data.products)) throw new Error("Unable to load saved products.");
        if (!controller.signal.aborted) {
          setProducts(data.products);
          resolved.current = { slugs: new Set(requested), attempt };
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load saved products.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [ready, key, attempt]);

  return { products: products.filter((product) => slugs.includes(product.slug)), loading, error, retry: () => setAttempt((value) => value + 1) };
}
