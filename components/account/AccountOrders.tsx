"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Package, ArrowUpRight } from "lucide-react";
import type { AccountOrder } from "@/lib/account";
import { useAccountMotion } from "./AccountMotion";
import { cardClass, focusClass, linkClass, secondaryClass, SectionHeading } from "./AccountUI";

function OrderRow({ order }: { order: AccountOrder }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const motion = useAccountMotion();
  const id = useId();
  useEffect(() => setMounted(true), []);
  function toggle() {
    const next = !open;
    setOpen(next);
    if (panel.current) motion[next ? "open" : "close"](panel.current);
  }
  return (
    <li className="min-w-0 border-b border-gold/20 last:border-b-0">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle}
        className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg py-5 text-left sm:gap-5 ${focusClass}`}>
        <div className="min-w-0">
          <span className="block text-xs text-ink-mid">{order.date}</span>
          <span title={order.id} className="mt-1 block text-[15px] font-semibold text-carbon">{order.reference}</span>
          <span className="mt-1 block text-xs text-ink-mid">{order.itemCount} {order.itemCount === 1 ? "item" : "items"}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right">
            <span className="mb-2 block text-[15px] font-semibold text-ink">{order.amount}</span>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ${order.status === "paid" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{order.status === "paid" ? "Paid" : "Awaiting payment"}</span>
          </div>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-carbon transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.5} />
        </div>
      </button>
      <div id={id} ref={panel} data-order-panel data-open={open} aria-hidden={mounted ? !open : undefined} inert={mounted && !open}>
        <div className="mb-5 rounded-xl border border-gold/15 bg-paper/70 px-4 py-1">
          <ul className="divide-y divide-gold/20">
            {order.items.map((item, index) => (
              <li key={`${item.itemCode}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 text-sm">
                <div className="min-w-0"><p className="break-words font-medium text-ink">{item.name}</p><p className="mt-1 break-all text-xs text-ink-mid">{item.itemCode}</p><p className="mt-2 text-xs text-ink-mid">{item.quantity} × {item.unitPrice}</p></div>
                <span className="font-semibold text-carbon">{item.total}</span>
              </li>
            ))}
          </ul>
          {order.paymentReference && <p className="break-all border-t border-gold/20 py-4 text-xs leading-5 text-ink-mid">Payment reference <span className="font-medium text-ink">{order.paymentReference}</span></p>}
        </div>
      </div>
    </li>
  );
}

export default function AccountOrders({ orders }: { orders: AccountOrder[] }) {
  return (
    <section id="orders" aria-labelledby="orders-heading" data-motion="section" className={cardClass}>
      <SectionHeading id="orders-heading">Your recent orders</SectionHeading>
      {orders.length ? <ul className="-mt-3">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</ul> : (
        <div className="rounded-xl border border-dashed border-gold/30 px-5 py-10 text-center">
          <Package aria-hidden="true" className="mx-auto h-7 w-7 text-[#a7772d]" strokeWidth={1.2} />
          <p className="mt-4 text-base text-ink-mid">No orders yet.</p>
          <Link href="/catalog" className={`mt-5 ${secondaryClass}`}>Browse the catalogue<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      )}
      <Link href="/contact" className={`mt-6 ${linkClass}`}>Need help with an order?<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
    </section>
  );
}
