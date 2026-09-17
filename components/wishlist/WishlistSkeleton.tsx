import { contentClass, gridClass, WishlistHeader } from "./WishlistUI";

export default function WishlistSkeleton({ page = false }: { page?: boolean }) {
  const cards = (
    <div data-motion="skeleton">
      <p role="status" className="sr-only">Loading your wishlist…</p>
      <div className={gridClass} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-gold/20 bg-white/70 motion-safe:animate-pulse">
            <div className="aspect-[4/5] bg-[#f0eae1]" />
            <div className="space-y-3 px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
              <div className="h-2.5 w-2/3 rounded bg-paper" />
              <div className="h-11 rounded bg-paper" />
              <div className="h-6 w-1/2 rounded bg-paper" />
              <div className="h-4 w-2/3 rounded bg-paper" />
              <div className="h-11 rounded-lg bg-paper" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return page ? (
    <main data-no-text-motion className="min-h-screen bg-[#fbf6ee]">
      <div className={contentClass}><WishlistHeader count={0} ready={false} />{cards}</div>
    </main>
  ) : cards;
}
