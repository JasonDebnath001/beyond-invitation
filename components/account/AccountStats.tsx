"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Heart, ShoppingBag, ArrowUpRight } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { focusClass } from "./AccountUI";

export default function AccountStats({ paidOrders, savedDesigns }: { paidOrders: number; savedDesigns: number }) {
  const { totalItems } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const tiles = [
    { label: "Orders", value: paidOrders, href: "/account#orders", icon: Package },
    { label: "Saved designs", value: savedDesigns, href: "/wishlist", icon: Heart },
    { label: "In your cart", value: mounted ? totalItems : null, href: "/cart", icon: ShoppingBag },
  ];
  return (
    <div aria-label="Account overview" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {tiles.map(({ label, value, href, icon: Icon }) => (
        <Link key={label} href={href} data-motion="tile" className={`group flex items-center justify-between gap-4 rounded-2xl border border-gold/20 bg-white/80 p-5 shadow-[0_1px_0_rgba(201,168,76,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-gold/50 sm:block sm:p-5 ${focusClass}`}>
          <div aria-hidden="true" className="hidden items-center justify-between text-[#a7772d] sm:flex"><Icon className="h-4 w-4" strokeWidth={1.5} /><ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:translate-x-0.5" strokeWidth={1.5} /></div>
          <div className="flex items-center gap-4 sm:mt-6 sm:block">
            <span aria-hidden="true" data-count={value ?? undefined} className="block min-w-[2ch] text-[40px] font-light leading-none tracking-tight text-[#50101f]">{value ?? "—"}</span>
            <span className="sr-only">{value === null ? "Loading" : value} </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mid sm:mt-3">{label}</span>
          </div>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-carbon transition-transform group-hover:translate-x-0.5 sm:hidden" strokeWidth={1.5} />
        </Link>
      ))}
    </div>
  );
}
