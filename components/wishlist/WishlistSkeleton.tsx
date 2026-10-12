import { contentClass, gridClass, WishlistHeader } from "./WishlistUI";

export default function WishlistSkeleton({ page = false }: { page?: boolean }) {
  const cards = (
    <div data-motion="skeleton">
      <p role="status" className="sr-only">Loading your wishlist…</p>
      <div className={gridClass} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="min-w-0 motion-safe:animate-pulse">
            <div className="aspect-square bg-neutral-100" />
            <div className="space-y-3 pt-2">
              <div className="h-4 w-4/5 rounded bg-neutral-100" />
              <div className="h-5 w-1/2 rounded bg-neutral-100" />
              <div className="h-3 w-2/5 rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return page ? (
    <main data-no-text-motion className="min-h-screen bg-white">
      <div className={contentClass}><WishlistHeader count={0} ready={false} />{cards}</div>
    </main>
  ) : cards;
}
