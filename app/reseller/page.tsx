import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reseller Enquiries | Beyond Invitation",
  robots: { index: false, follow: false },
};

export default function ResellerPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-maroon">Partner with us</h1>
      <p className="mt-4 text-ink-light">Contact our team to join our reseller programme or update your existing reseller details.</p>
      <Link href="/contact" className="mt-6 inline-block underline">Make a reseller enquiry</Link>
    </main>
  );
}
