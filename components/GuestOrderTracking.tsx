"use client";

import Link from "next/link";
import OrderTracking from "@/components/account/OrderTracking";
import PrivateTrackingLink from "@/components/PrivateTrackingLink";
import { usePrivateTrackingToken } from "@/components/usePrivateTrackingToken";

export default function GuestOrderTracking({ orderId }: { orderId: string }) {
  const { ready, token } = usePrivateTrackingToken();
  if (!ready) return <p role="status" className="mt-6 text-ink-mid">Opening your tracking link…</p>;
  if (!token) return (
    <div className="mt-6 rounded-xl border border-gold/25 bg-paper p-5">
      <p className="text-ink-mid">This private tracking link is incomplete. Use the full link saved from your order confirmation.</p>
      <Link href="/account#orders" className="mt-4 inline-block font-semibold text-carbon underline">View orders in your account</Link>
    </div>
  );
  return (
    <div className="mt-6">
      <OrderTracking orderId={orderId} trackingToken={token} />
      <PrivateTrackingLink orderId={orderId} showOpenLink={false} />
    </div>
  );
}
