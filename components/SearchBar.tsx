"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";

const MAX_DROPDOWN_RESULTS = 6;

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });

        const data = (await res.json()) as { results: Product[] };

        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
        }
      } catch (error) {
        const err = error as { name?: string };

        if (err.name !== "AbortError") {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const q = query.trim();
    if (!q) return;

    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function goToProduct(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/products/${slug}`);
  }

  const shown = results.slice(0, MAX_DROPDOWN_RESULTS);
  const showDropdown = open && query.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full lg:w-auto"
    >
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-neutral-400">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search cards"
            aria-label="Search products"
            className="w-full rounded-full border border-neutral-300 bg-white py-2.5 pl-9 pr-4 text-[13px] text-carbon shadow-sm transition-all placeholder:text-neutral-400 focus:border-carbon focus:outline-none focus:ring-2 focus:ring-carbon/10 lg:w-48 lg:focus:w-64"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-0 animate-fadeDown overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_44px_rgba(0,0,0,0.12)] lg:w-80">
          {loading && (
            <p className="px-4 py-3 text-[13px] text-neutral-400">
              Searching&hellip;
            </p>
          )}

          {!loading && shown.length === 0 && (
            <p className="px-4 py-3 text-[13px] text-neutral-400">
              No products found for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {!loading &&
            shown.map((product) => (
              <button
                key={product.slug}
                type="button"
                onClick={() => goToProduct(product.slug)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-neutral-100 text-lg">
                  {product.emoji}
                </span>

                <span className="flex-1 truncate text-[13px] font-medium text-carbon">
                  {product.name}
                </span>
              </button>
            ))}

          {!loading && results.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              className="block w-full border-t border-neutral-200 bg-paper px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon transition-colors hover:bg-neutral-100"
            >
              See all {results.length} results &#8594;
            </button>
          )}
        </div>
      )}
    </div>
  );
}