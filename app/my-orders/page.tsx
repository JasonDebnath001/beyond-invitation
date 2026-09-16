import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Order Help | Beyond Invitation",
  robots: { index: false, follow: false },
};

export default function MyOrdersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-maroon">Need help with an order?</h1>
      <p className="mt-4 text-ink-light">Contact our team with your order or payment reference for an update.</p>
      <Link href="/contact" className="mt-6 inline-block underline">Contact us about your order</Link>
    </main>
  );
}
