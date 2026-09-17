import type { ReactNode } from "react";

export const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2";
export const cardClass = "min-w-0 scroll-mt-28 rounded-2xl border border-gold/20 bg-white/80 p-6 sm:p-8 shadow-[0_1px_0_rgba(201,168,76,0.25),0_18px_40px_-28px_rgba(80,16,31,0.35)]";
export const inputClass = `mt-2 w-full rounded-xl border border-carbon/15 bg-white px-4 py-3 text-[15px] font-normal normal-case tracking-normal text-ink placeholder:text-ink-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 ${focusClass}`;
export const labelClass = "block text-[11px] font-bold uppercase tracking-[0.18em] text-ink-mid";
export const primaryClass = `inline-flex items-center justify-center gap-2 rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-carbon-dark disabled:opacity-50 motion-reduce:transition-none ${focusClass}`;
export const secondaryClass = `inline-flex items-center justify-center gap-2 rounded-full border border-carbon/20 px-5 py-2.5 text-sm font-semibold text-carbon transition-colors hover:bg-paper disabled:opacity-50 motion-reduce:transition-none ${focusClass}`;
export const linkClass = `inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-carbon underline decoration-gold/60 underline-offset-4 transition-colors hover:text-carbon-dark ${focusClass}`;

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-6 text-xl font-medium text-[#50101f]">{children}</h2>
  );
}
