/** Prefetched navigation feedback while the requested product is resolved. */
export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:py-12" role="status" aria-label="Loading product details">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-5 h-4 w-52 rounded bg-paper sm:mb-8" />
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] xl:gap-10">
          <div className="aspect-[4/5] min-h-[360px] rounded-2xl bg-paper sm:min-h-[560px] lg:h-[calc(100svh-8rem)] lg:min-h-[520px] lg:max-h-[720px]" />
          <div className="space-y-5">
            <div className="space-y-6 rounded-2xl border border-gold/15 p-4 sm:p-6">
              <div className="h-3 w-36 rounded bg-paper" />
              <div className="h-10 w-full rounded bg-paper" />
              <div className="h-8 w-32 rounded bg-paper" />
              <div className="h-px bg-paper" />
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
