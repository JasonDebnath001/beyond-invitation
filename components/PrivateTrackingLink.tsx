"use client";

import { useState } from "react";
import Link from "next/link";
import { privateTrackingLink } from "@/lib/order-tracking-link";
import { usePrivateTrackingToken } from "@/components/usePrivateTrackingToken";

export default function PrivateTrackingLink({ orderId, showOpenLink = true }: { orderId: string; showOpenLink?: boolean }) {
  const { token } = usePrivateTrackingToken();
  const href = privateTrackingLink(orderId, token);
  const [message, setMessage] = useState("");
  if (!href) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href!, window.location.origin).href);
      setMessage("Private tracking link copied.");
    } catch {
      setMessage("Open the tracking page and bookmark it to keep your private link.");
    }
  }

  return (
    <div className="mt-7 rounded-xl border border-gold/25 bg-paper/70 p-5">
      <div className="flex flex-wrap justify-center gap-3">
        {showOpenLink && <Link href={href} prefetch={false} rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-carbon px-5 py-3 text-base font-semibold text-white transition hover:bg-carbon-dark focus:outline-none focus:ring-2 focus:ring-gold">Track your order</Link>}
        <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center rounded-lg border border-carbon/25 px-5 py-3 text-base font-semibold text-carbon transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-gold">Copy private tracking link</button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-mid">Save this private link to check delivery updates without signing in. Anyone with the link can view this order’s tracking.</p>
      <p role="status" className="mt-2 text-sm text-ink-mid">{message}</p>
    </div>
  );
}
