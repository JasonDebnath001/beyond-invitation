"use client";

import { useEffect, useState, type ReactNode } from "react";
import { User, Package, Heart, ShieldCheck, ShoppingBag } from "lucide-react";
import { focusClass } from "./AccountUI";

const sections = [
  { id: "overview", label: "Overview", icon: ShoppingBag },
  { id: "orders", label: "Orders", icon: Package },
  { id: "saved", label: "Saved designs", icon: Heart },
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function AccountShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const elements = sections.map(({ id }) => document.getElementById(id)).filter((node): node is HTMLElement => !!node);
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
      const current = elements.filter((element) => visible.has(element.id))
        .sort((a, b) => Math.abs(a.getBoundingClientRect().top - 112) - Math.abs(b.getBoundingClientRect().top - 112))[0];
      if (current) setActive(current.id);
    }, { rootMargin: "-112px 0px -40% 0px", threshold: [0, 0.2, 0.5, 1] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pt-16">
      {header}
      <div className="mt-7 grid min-w-0 gap-7 lg:mt-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0">
          <nav aria-label="Account sections" data-motion="rail" className="flex gap-2 overflow-x-auto px-1 py-2 lg:sticky lg:top-28 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-l lg:border-gold/25 lg:p-0">
            {sections.map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined} onClick={() => setActive(id)}
                className={`relative flex shrink-0 items-center gap-3 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors lg:rounded-r-xl lg:rounded-l-none lg:border-0 lg:px-5 lg:py-3.5 lg:text-sm ${focusClass} ${active === id ? "border-gold/50 bg-white/80 text-carbon lg:bg-gold/10" : "border-carbon/15 text-ink-mid hover:bg-white/60 hover:text-carbon"}`}>
                {active === id && <span aria-hidden="true" className="absolute -left-px top-2.5 hidden h-[calc(100%-20px)] w-0.5 rounded-full bg-gold lg:block" />}
                <Icon aria-hidden="true" className="hidden h-4 w-4 lg:block" strokeWidth={1.5} />{label}
              </a>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-6 sm:space-y-8">{children}</div>
      </div>
    </div>
  );
}
