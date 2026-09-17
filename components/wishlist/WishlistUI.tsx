export const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2";
export const primaryClass = `inline-flex items-center justify-center rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-carbon-dark motion-reduce:transition-none ${focusClass}`;
export const secondaryClass = `inline-flex items-center justify-center gap-2 rounded-full border border-carbon/20 px-6 py-3 text-sm font-semibold text-carbon transition-colors hover:bg-paper disabled:opacity-50 motion-reduce:transition-none ${focusClass}`;
export const gridClass = "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4";
export const contentClass = "relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16";

export function WishlistHeader({ shared = false, count, ready = true, signedIn = false }: {
  shared?: boolean; count: number; ready?: boolean; signedIn?: boolean;
}) {
  const title = shared ? "A shortlist for you" : "Your wishlist";
  return (
    <header className="mb-7 sm:mb-9">
      <p data-motion="eyebrow" className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#a7772d]">{shared ? "Shared with you" : "Saved for later"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="text-[34px] font-light leading-tight tracking-[-0.035em] text-[#50101f] sm:text-[40px] lg:text-[48px]">
          {title.split(" ").map((word, index) => <span key={word} data-motion="heading-word" className="inline-block">{index > 0 ? "\u00a0" : ""}{word}</span>)}
        </h1>
      </div>
      <div data-header-rule className="mt-7 h-px bg-gradient-to-r from-gold via-gold/40 to-transparent sm:mt-9" />
    </header>
  );
}

export function WishlistError({ message, onRetry, disabled = false, alert = true }: {
  message: string; onRetry: () => void; disabled?: boolean; alert?: boolean;
}) {
  return (
    <div role={alert ? "alert" : undefined} className="rounded-2xl border border-maroon/20 bg-white p-6">
      <p className="text-sm text-maroon">{message}</p>
      <button type="button" onClick={onRetry} disabled={disabled} className={`mt-4 ${secondaryClass}`}>Try again</button>
    </div>
  );
}
