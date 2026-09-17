"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { buildWishlistShareUrl, type WishlistSortKey } from "@/lib/wishlist";
import type { Product } from "@/types";
import { focusClass, secondaryClass } from "./WishlistUI";

export default function WishlistToolbar({ products, slugs, sortKey, onSort, disabled = false, shared = false }: {
  products: Product[]; slugs: string[]; sortKey: WishlistSortKey; onSort: (key: WishlistSortKey) => void;
  disabled?: boolean; shared?: boolean;
}) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timeout.current) clearTimeout(timeout.current); };
  }, []);
  const priced = products.filter((product) => Number.isFinite(product.price) && product.price > 0).length;

  async function share() {
    if (sharing) return;
    setSharing(true); setMessage(""); setError("");
    if (timeout.current) clearTimeout(timeout.current);
    try {
      const url = buildWishlistShareUrl(window.location.origin, slugs);
      if (navigator.share && (navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches)) {
        await navigator.share({ title: "My Beyond Invitation shortlist", url });
      } else {
        if (!navigator.clipboard?.writeText) throw new Error("Copying is unavailable in this browser. Please try another browser.");
        await navigator.clipboard.writeText(url);
        if (!mounted.current) return;
        setMessage(slugs.length > 40 ? "Link copied (first 40 designs)" : "Link copied");
        timeout.current = setTimeout(() => setMessage(""), 2500);
      }
    } catch (err) {
      if (mounted.current && !(err instanceof Error && err.name === "AbortError")) {
        setError("The list could not be shared. Please try again.");
      }
    } finally { if (mounted.current) setSharing(false); }
  }

  return (
    <div data-motion="toolbar" className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {products.length > 0 && <>
          <label htmlFor={id} className="sr-only">Sort saved designs</label>
          <select id={id} value={sortKey} disabled={disabled} onChange={(event) => onSort(event.target.value as WishlistSortKey)}
            className={`max-w-full rounded-full border border-carbon/15 bg-white px-4 py-2 text-sm font-semibold text-carbon disabled:opacity-50 ${focusClass}`}>
            <option value="recent">Recently added</option><option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option><option value="name">Name: A to Z</option>
          </select>
        </>}
        {!shared && slugs.length > 0 && <button type="button" onClick={share} disabled={sharing} className={secondaryClass}><Share2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />Share list</button>}
      </div>
      {message && <p role="status" className="w-full text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="w-full text-sm text-maroon">{error}</p>}
    </div>
  );
}
