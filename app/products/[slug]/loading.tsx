/** Prefetched navigation feedback while the requested product is resolved. */
export default function ProductDetailLoading() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:py-12"
      role="status"
      aria-label="Loading product details"
    >
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-5 h-4 w-52 rounded bg-paper sm:mb-8" />
        <div className="grid min-w-0 gap-6 lg:flex lg:items-start lg:gap-4 xl:gap-6">
          <div className="min-w-0 md:grid md:grid-cols-[72px_minmax(0,1fr)] md:gap-4 lg:w-[calc((100dvh-12rem)*0.75+88px)] lg:shrink xl:w-[calc((100dvh-12rem)*0.75+96px)] xl:grid-cols-[80px_minmax(0,1fr)]">
            <div className="hidden space-y-3 md:block">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="aspect-square bg-paper" />
              ))}
            </div>
            <div className="aspect-[3/4] bg-paper md:max-h-[calc(100dvh-12rem)]" />
          </div>
          <div className="space-y-5 lg:min-w-[360px] lg:flex-1 xl:min-w-[400px]">
            <div className="space-y-6 rounded-2xl border border-gold/15 p-4 sm:p-6">
              <div className="h-10 w-full rounded bg-paper" />
              <div className="h-8 w-32 rounded bg-paper" />
              <div className="h-12 w-36 rounded-full bg-paper" />
              <div className="h-12 w-full rounded-full bg-paper" />
            </div>
            <div className="h-32 rounded-2xl bg-paper" />
          </div>
        </div>
      </div>
    </div>
  );
}
