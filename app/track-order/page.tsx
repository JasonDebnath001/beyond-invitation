import type { Metadata } from "next";
import Link from "next/link";
import GuestOrderTracking from "@/components/GuestOrderTracking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TrackOrderPage({ searchParams }: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order } = await searchParams;
  const validOrder = typeof order === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(order);
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-semibold text-maroon-dark sm:text-4xl">Track your order</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-mid">Check your parcel’s progress and the latest courier updates.</p>
      {validOrder ? <GuestOrderTracking orderId={order} /> : (
        <div className="mt-6 rounded-xl border border-gold/25 bg-paper p-5">
          <p className="text-ink-mid">Open the private tracking link saved from your order confirmation, or sign in to view your orders.</p>
          <Link href="/account#orders" className="mt-4 inline-block font-semibold text-carbon underline">View my orders</Link>
        </div>
      )}
      <Link href="/contact" className="mt-8 inline-block text-sm font-semibold text-carbon underline">Need help with your order?</Link>
    </main>
  );
}
