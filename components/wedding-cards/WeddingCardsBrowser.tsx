"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import WeddingCardTile from "@/components/wedding-cards/WeddingCardTile";
import { useWeddingCardsMotion } from "@/components/wedding-cards/WeddingCardsMotion";
import {
  applyWeddingFilters,
  DEFAULT_WEDDING_FILTERS,
  facetCounts,
  parseWeddingFilters,
  serializeWeddingFilters,
  sortWeddingProducts,
  WEDDING_SORTS,
  type BrowserProduct,
  type WeddingFilters,
  type WeddingCollectionType,
} from "@/lib/wedding-cards";

const gridClass =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4";
const secondary =
  "rounded-md border border-carbon/20 bg-white px-6 py-3 text-sm font-semibold text-carbon transition-colors hover:bg-paper focus-visible:outline-gold";
type FacetOption = { value: string; label: string; count: number };

function Facet({
  label,
  options,
  value,
  anyLabel,
  anyValue,
  total,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  value: string;
  anyLabel: string;
  anyValue: string;
  total: number;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-carbon">
        {label}
      </legend>
      <div className="space-y-0.5">
        {[{ value: anyValue, label: anyLabel, count: total }, ...options].map(
          (option) => {
            const selected = value.toLowerCase() === option.value.toLowerCase();
            const className = `flex w-full items-center gap-2.5 rounded-sm py-2 text-left text-sm transition-colors focus-visible:outline-gold ${selected ? "font-semibold text-maroon" : "text-ink-mid hover:text-maroon"}`;
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-maroon" : "border-carbon/25"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-maroon" : "bg-transparent"}`}
                  />
                </span>
                <span>{option.label}</span>
                <span className="ml-auto pl-2 text-xs font-normal tabular-nums text-ink-mid/70">
                  {option.count}
                </span>
              </>
            );
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={className}
              >
                {content}
              </button>
            );
          },
        )}
      </div>
    </fieldset>
  );
}

export function WeddingCardsSkeleton({ productLabel = "wedding cards" }: { productLabel?: string }) {
  return (
    <div role="status" aria-label={`Loading ${productLabel}`} className={gridClass}>
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-gold/20 bg-white"
        >
          <div className="aspect-[4/5] bg-[#f3e7cf]/50" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-2/3 rounded bg-paper" />
            <div className="h-5 w-1/2 rounded bg-paper" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading designs</span>
    </div>
  );
}

export default function WeddingCardsBrowser({
  products,
  collectionType,
}: {
  products: BrowserProduct[];
  collectionType?: WeddingCollectionType;
}) {
  const productLabel = collectionType === "boxes" ? "wedding boxes" : "wedding cards";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramsKey = searchParams.toString();
  const filters = useMemo(
    () => {
      const parsed = parseWeddingFilters(new URLSearchParams(paramsKey));
      // Collection membership is fixed by the server, even for a stale type URL.
      return collectionType ? { ...parsed, type: "all" as const } : parsed;
    },
    [paramsKey, collectionType],
  );
  const filterKey = serializeWeddingFilters(filters);
  const [pagination, setPagination] = useState({ key: filterKey, count: 24 });
  const [sheetOpen, setSheetOpen] = useState(false);
  const pendingFilters = useRef(filters);
  const motion = useWeddingCardsMotion();
  const facets = useMemo(() => facetCounts(products), [products]);
  const matches = sortWeddingProducts(
    applyWeddingFilters(products, filters),
    filters.sort,
  );
  const shown = pagination.key === filterKey ? pagination.count : 24;
  const visible = matches.slice(0, shown);
  const visibleKey = visible.map((product) => product.slug).join("|");
  const hasFilters =
    filters.type !== "all" ||
    filters.price !== "any";
  const browserRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);
  const sortId = useId();
  const sheetTitleId = useId();

  useEffect(() => {
    pendingFilters.current = filters;
  }, [filters]);
  useLayoutEffect(() => {
    const browser = browserRef.current;
    if (!browser) return;
    // The parent motion wrapper can mount before this Suspense boundary hydrates.
    browser.dataset.motionReady = "true";
    motion.reorderEnd();
    motion.revealNew();
    return () => { delete browser.dataset.motionReady; };
  }, [visibleKey, filterKey, motion]);

  useEffect(() => {
    const beforeHistoryChange = () => motion.reorderStart();
    window.addEventListener("popstate", beforeHistoryChange);
    return () => window.removeEventListener("popstate", beforeHistoryChange);
  }, [motion]);

  useEffect(() => {
    const sheet = sheetRef.current,
      backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    if (!sheetOpen) {
      if (sheetWasOpen.current) {
        motion.closeSheet(sheet, backdrop);
        filterButtonRef.current?.focus({ preventScroll: true });
      }
      sheetWasOpen.current = false;
      return;
    }
    sheetWasOpen.current = true;
    motion.openSheet(sheet, backdrop);
    const frame = window.requestAnimationFrame(() =>
      sheet
        .querySelector<HTMLElement>("[aria-pressed]")
        ?.focus({ preventScroll: true }),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSheetOpen(false);
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          sheet.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], select, [tabindex='0']",
          ),
        ).filter((element) => !element.hidden);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !sheet.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !sheet.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => {
      if (desktop.matches) setSheetOpen(false);
    };
    desktop.addEventListener("change", onDesktop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      desktop.removeEventListener("change", onDesktop);
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen, motion]);

  function update(patch: Partial<WeddingFilters>) {
    const next = { ...pendingFilters.current, ...patch };
    pendingFilters.current = next;
    motion.reorderStart();
    const query = new URLSearchParams(searchParams.toString());
    for (const key of ["type", "text", "price", "photos", "sort"])
      query.delete(key);
    new URLSearchParams(serializeWeddingFilters(next)).forEach((value, key) =>
      query.set(key, value),
    );
    setPagination({ key: serializeWeddingFilters(next), count: 24 });
    router.replace(`${pathname}${query.size ? `?${query}` : ""}`, {
      scroll: false,
    });
  }

  const facetControls = (
    <div className="space-y-6">
      {!collectionType ? (
        <Facet
          label="Categories"
          options={facets.types}
          value={filters.type}
          anyLabel="All"
          anyValue="all"
          total={facets.total}
          onChange={(type) => update({ type: type as WeddingFilters["type"] })}
        />
      ) : null}
      {collectionType || facets.showPrice ? (
        <Facet
          label="Price per piece"
          options={facets.prices}
          value={filters.price}
          anyLabel="All prices"
          anyValue="any"
          total={facets.total}
          onChange={(price) =>
            update({ price: price as WeddingFilters["price"] })
          }
        />
      ) : null}
    </div>
  );

  return (
    <div
      data-wedding-browser
      ref={browserRef}
      className="grid items-start gap-x-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-x-10 xl:grid-cols-[240px_minmax(0,1fr)]"
    >
      <aside
        aria-label={`Filter ${productLabel}`}
        data-filter-sidebar
        className="hidden border-r border-carbon/10 pr-6 lg:block"
      >
        <div className="mb-5 flex h-11 items-center justify-between gap-2 border-b border-carbon/10">
          <h2 className="text-base font-semibold text-carbon">Filters</h2>
          {hasFilters ? (
            <button
              type="button"
              aria-label="Clear filters"
              onClick={() =>
                update({ ...DEFAULT_WEDDING_FILTERS, sort: filters.sort })
              }
              className="py-2 text-xs text-ink-mid underline underline-offset-4 hover:text-maroon"
            >
              Clear filters
            </button>
          ) : null}
        </div>
        {facetControls}
      </aside>
      <div className="min-w-0">
        <div
          data-catalogue-toolbar
          className="mb-5 flex min-h-11 flex-wrap items-center justify-between gap-x-3 border-b border-carbon/10 pb-2 lg:pb-0"
        >
          <p
            role="status"
            aria-live="polite"
            className="text-sm tabular-nums text-ink-mid"
          >
            {matches.length} designs
          </p>
          <div className="flex items-center gap-4">
            <button
              ref={filterButtonRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-carbon focus-visible:outline-gold lg:hidden"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Filters
              {hasFilters ? (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-maroon"
                />
              ) : null}
            </button>
            <div className="flex items-center gap-2">
              <label
                htmlFor={sortId}
                className="hidden text-sm text-ink-mid sm:block"
              >
                Sort by
              </label>
              <div className="relative">
                <select
                  id={sortId}
                  aria-label={`Sort ${productLabel}`}
                  value={filters.sort}
                  onChange={(event) =>
                    update({
                      sort: event.target.value as WeddingFilters["sort"],
                    })
                  }
                  className="min-h-11 max-w-[155px] cursor-pointer appearance-none rounded-none border-0 bg-transparent py-2 pl-0 pr-5 text-sm font-semibold text-carbon focus-visible:outline-gold"
                >
                  {WEDDING_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-carbon"
                />
              </div>
            </div>
          </div>
        </div>
        {visible.length ? (
          <>
            <div data-wedding-grid className={gridClass}>
              {visible.map((product, index) => (
                <WeddingCardTile key={product.slug} product={product} priority={index < 4} />
              ))}
            </div>
            <div className="mt-10 text-center">
              <p className="mb-4 text-sm text-ink-mid">
                Showing {visible.length} of {matches.length} designs
              </p>
              {visible.length < matches.length ? (
                <button
                  type="button"
                  className={secondary}
                  onClick={() =>
                    setPagination({ key: filterKey, count: shown + 24 })
                  }
                >
                  Show more
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="border border-carbon/10 bg-white px-6 py-12 text-center">
            <p className="text-xl font-light text-maroon">
              No designs match these filters.
            </p>
            <button
              type="button"
              onClick={() =>
                update({ ...DEFAULT_WEDDING_FILTERS, sort: filters.sort })
              }
              className={`mt-5 ${secondary}`}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <div
        ref={backdropRef}
        hidden
        className="fixed inset-0 z-[200] bg-carbon/40"
        onClick={(event) => {
          if (event.target === event.currentTarget) setSheetOpen(false);
        }}
      >
        <div
          ref={sheetRef}
          hidden
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
          className="absolute inset-y-0 left-0 w-full max-w-sm overflow-y-auto overscroll-contain bg-[#faf8f5] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-carbon/10 pb-3">
            <h3 id={sheetTitleId} className="text-xl font-semibold text-maroon">
              Filters
            </h3>
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => setSheetOpen(false)}
              className="p-3 text-carbon"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {facetControls}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="flex-1 rounded-md bg-carbon px-6 py-3 text-sm font-semibold text-white hover:bg-carbon-dark"
            >
              Show {matches.length} designs
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={() =>
                  update({ ...DEFAULT_WEDDING_FILTERS, sort: filters.sort })
                }
                className={secondary}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
