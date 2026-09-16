import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/components/siteConfig";

export const metadata: Metadata = {
  title: `Order Confirmed – ${BRAND}`,
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  searchParams: Promise<{ payment_id?: string; order_id?: string; pending?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { payment_id, order_id, pending } = await searchParams;
  const paymentPending = pending === "1";

  return (
    <div className="mx-auto min-w-0 max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-5 font-display text-3xl font-semibold text-maroon-dark md:text-4xl">
        {paymentPending ? "Payment confirmation pending" : "Payment successful"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-mid">
        {paymentPending
          ? "We are confirming your payment. Please do not pay again. Keep your payment reference and contact us if you need an update."
          : "Thank you for your order. Our team will reach out shortly to confirm personalisation details and proof approval."}
      </p>

      {order_id && (
        <p className="mt-5 break-words text-sm text-ink-mid">
          Order reference: <span className="font-medium text-ink">{order_id}</span>
        </p>
      )}

      {paymentPending && (
        <Link href="/contact" className="mt-4 inline-block text-sm underline">Contact us about your payment</Link>
      )}

      {payment_id && (
        <p className="mt-5 max-w-full break-words rounded-lg border border-gold/30 bg-paper px-4 py-2 text-[12.5px] text-ink-mid [overflow-wrap:anywhere] sm:inline-block">
          Payment ID: <span className="font-medium text-ink">{payment_id}</span>
        </p>
      )}

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex max-w-full items-center justify-center gap-2 bg-carbon px-5 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-carbon-dark sm:px-7"
        >
          Back to Home →
        </Link>
      </div>
    </div>
  );
}
