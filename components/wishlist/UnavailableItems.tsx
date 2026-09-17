"use client";

import { useEffect, useState } from "react";
import { useWishlist } from "@/components/WishlistProvider";
import { focusClass, secondaryClass } from "./WishlistUI";

export default function UnavailableItems({ slugs }: { slugs: string[] }) {
  const wishlist = useWishlist();
  const [queue, setQueue] = useState<string[]>([]);
  const [inFlight, setInFlight] = useState<string | null>(null);

  useEffect(() => {
    if (!wishlist.ready) {
      if (queue.length) setQueue([]);
      if (inFlight) setInFlight(null);
      return;
    }
    if (wishlist.syncing || !queue.length) return;
    if (inFlight) {
      // A failed write rolls back the slug. Stop and let the provider show its sync error.
      setQueue(wishlist.slugs.includes(inFlight) ? [] : queue.slice(1));
      setInFlight(null);
      return;
    }
    const slug = queue[0];
    if (!wishlist.slugs.includes(slug)) { setQueue(queue.slice(1)); return; }
    setInFlight(slug);
    wishlist.removeItem(slug);
  }, [queue, inFlight, wishlist]);

  if (!slugs.length) return null;
  const busy = wishlist.syncing || queue.length > 0;
  return (
    <section aria-label="Unavailable saved designs" className="mt-7 rounded-2xl border border-dashed border-gold/40 bg-paper/60 p-5">
      <p className="text-sm text-ink-mid">{slugs.length} saved {slugs.length === 1 ? "item is" : "items are"} no longer available.</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((slug) => <li key={slug} className="flex max-w-full items-center gap-3 rounded-full bg-white px-3 py-1 text-xs text-ink-mid">
          <span className="min-w-0 break-all">{slug}</span>
          <button type="button" disabled={busy} aria-label={`Remove unavailable design ${slug}`} onClick={() => wishlist.removeItem(slug)} className={`shrink-0 rounded-sm py-1 font-semibold text-carbon underline underline-offset-2 disabled:opacity-50 ${focusClass}`}>Remove</button>
        </li>)}
      </ul>
      <button type="button" disabled={busy} onClick={() => setQueue([...slugs])} className={`mt-5 ${secondaryClass}`}>{queue.length ? "Removing unavailable designs…" : "Remove all unavailable"}</button>
    </section>
  );
}
