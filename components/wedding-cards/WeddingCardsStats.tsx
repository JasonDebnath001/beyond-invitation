export type WeddingStats = {
  total: number;
  priced: number;
  withPhotos: number;
  minPrice: number | null;
};

export default function WeddingCardsStats({ stats }: { stats: WeddingStats }) {
  const valueClass = "text-3xl font-light tracking-tight text-maroon";
  const labelClass = "mt-1 text-sm text-ink-mid";
  return (
    <section
      aria-label="Collection at a glance"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-gold/20 py-6 lg:grid-cols-4">
        <div data-motion="stat">
          <p className={valueClass}>
            <span data-count-to={stats.total}>
              {stats.total.toLocaleString("en-IN")}
            </span>
          </p>
          <p className={labelClass}>designs</p>
        </div>
        {stats.minPrice != null ? (
          <div data-motion="stat">
            <p className={valueClass}>
              From ₹
              <span data-count-to={stats.minPrice}>
                {stats.minPrice.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>
            <p className={labelClass}>per piece</p>
          </div>
        ) : null}
        <div data-motion="stat">
          <p className={valueClass}>
            <span data-count-to={50}>50</span>
          </p>
          <p className={labelClass}>pieces minimum</p>
        </div>
        <div data-motion="stat">
          <p className={valueClass}>Pan-India</p>
          <p className={labelClass}>delivery</p>
        </div>
      </div>
    </section>
  );
}
