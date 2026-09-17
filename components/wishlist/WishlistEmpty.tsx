import Link from "next/link";
import { primaryClass, secondaryClass } from "./WishlistUI";

export default function WishlistEmpty({ shared = false }: { shared?: boolean }) {
  return (
    <div data-motion="empty" className="rounded-3xl border border-gold/20 bg-white/80 px-6 py-14 text-center sm:py-20">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-10 w-10 text-gold">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
      <h2 className="mt-6 text-2xl font-light tracking-tight text-[#50101f]">{shared ? "No designs in this shortlist" : "Your wishlist is empty"}</h2>
      <p className="mt-3 text-sm leading-6 text-ink-mid">{shared ? "These designs are no longer available." : "Tap the heart on any design to save it here."}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/wedding-cards" className={primaryClass}>Browse wedding cards</Link>
        <Link href="/catalog" className={secondaryClass}>View the catalogue</Link>
      </div>
    </div>
  );
}
