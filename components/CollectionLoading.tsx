/** Shared native route fallback; it does not fetch products or mount images. */
export default function CollectionLoading({ label = "Loading collection" }: { label?: string }) {
  return (
    <section
      className="mx-auto min-h-[70vh] max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      role="status"
      aria-busy="true"
      data-no-text-motion
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-8 space-y-4">
          <div className="h-3 w-40 rounded bg-paper" />
          <div className="h-9 w-3/4 max-w-lg rounded bg-paper sm:h-12" />
          <div className="h-4 w-full max-w-2xl rounded bg-paper" />
        </div>
        <div className="mb-6 h-16 rounded-2xl border border-gold/15 bg-paper/60" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="min-w-0 space-y-3">
              <div className="aspect-square bg-neutral-100" />
              <div className="h-4 w-4/5 rounded bg-paper" />
              <div className="h-4 w-2/5 rounded bg-paper" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
