/** Native Next route fallback while the destination's server content resolves. */
export default function PageLoading() {
  return (
    <section
      className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      role="status"
      aria-busy="true"
      data-no-text-motion
    >
      <span className="sr-only">Loading page</span>
      <div aria-hidden="true" className="space-y-8 motion-safe:animate-pulse">
        <div className="space-y-4">
          <div className="h-3 w-36 rounded bg-paper" />
          <div className="h-10 w-3/4 max-w-lg rounded bg-paper" />
          <div className="h-4 w-full max-w-2xl rounded bg-paper" />
        </div>
        <div className="h-64 rounded-2xl bg-paper sm:h-80" />
        <div className="grid gap-6 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-3">
              <div className="h-5 w-1/2 rounded bg-paper" />
              <div className="h-4 w-full rounded bg-paper" />
              <div className="h-4 w-4/5 rounded bg-paper" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
