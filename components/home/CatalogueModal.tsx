"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { CatalogBrowsePage } from "@/lib/catalog-browse-options";
import type { CatalogueRange } from "@/lib/catalogue-ranges";

const gridClass = "grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4";
const buttonClass = "rounded-full border border-carbon px-6 py-3 text-sm font-semibold text-carbon transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-50";

export default function CatalogueModal({ range, onClose }: {
  range: CatalogueRange;
  onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backdropPressed = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const failedOffset = useRef(0);
  const [page, setPage] = useState<CatalogBrowsePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${padding + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  const loadPage = useCallback(async (offset: number) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    failedOffset.current = offset;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range: range.id, offset: String(offset) });
      const response = await fetch(`/api/catalog/ranges?${params}`, {
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Catalogue unavailable");
      const result = await response.json() as CatalogBrowsePage;
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (
        !Array.isArray(result.products) ||
        !Number.isSafeInteger(result.total) || result.total < 0 ||
        !(result.nextOffset === null || (Number.isSafeInteger(result.nextOffset) && result.nextOffset > offset))
      ) throw new Error("Invalid catalogue page");
      setPage((current) => {
        const products = offset > 0 && current ? [...current.products] : [];
        const seen = new Set(products.map((product) => product.slug));
        for (const product of result.products) {
          if (!seen.has(product.slug)) {
            products.push(product);
            seen.add(product.slug);
          }
        }
        return { ...result, products };
      });
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) {
        setError("We couldn't load these wedding cards. Please try again.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [range.id]);

  useEffect(() => {
    void loadPage(0);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [loadPage]);

  function isOutsideDialog(clientX: number, clientY: number) {
    const bounds = dialogRef.current?.getBoundingClientRect();
    return Boolean(bounds && (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom));
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      data-no-text-motion
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onPointerDown={(event) => { backdropPressed.current = event.target === event.currentTarget && isOutsideDialog(event.clientX, event.clientY); }}
      onClick={(event) => {
        if (backdropPressed.current && event.target === event.currentTarget && isOutsideDialog(event.clientX, event.clientY)) onClose();
        backdropPressed.current = false;
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border-0 bg-white p-0 text-carbon shadow-2xl backdrop:bg-carbon/60 backdrop:backdrop-blur-sm sm:w-[calc(100%-3rem)]"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gold/20 px-5 py-5 sm:px-8 sm:py-6">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Explore the catalogue</p>
            <h2 id={`${id}-title`} className="font-serif text-2xl font-semibold text-maroon sm:text-3xl">{range.title} wedding cards</h2>
            <p id={`${id}-description`} className="mt-2 text-sm text-ink-mid">{range.price} per card. Browse designs and view product details.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close catalogue"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-carbon/15 text-carbon transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8" aria-busy={loading}>
          <p role="status" className={page ? "mb-5 text-sm text-ink-mid" : "sr-only"}>
            {loading ? (page ? "Loading more wedding cards…" : "Loading wedding cards…") : page ? `${page.products.length} of ${page.total} designs` : ""}
          </p>

          {!page && loading && (
            <div className={gridClass} aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="min-w-0 motion-safe:animate-pulse">
                  <div className="aspect-square rounded bg-stone-100" />
                  <div className="mt-3 h-4 w-4/5 rounded bg-stone-100" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-stone-100" />
                </div>
              ))}
            </div>
          )}

          {page && page.products.length > 0 && (
            <div className={gridClass}>
              {page.products.map((product) => (
                <ProductCard key={product.slug} product={product}
                  imageSizes="(min-width: 1024px) 255px, (min-width: 640px) 30vw, 45vw" />
              ))}
            </div>
          )}

          {page && page.products.length === 0 && !loading && (
            <div className="rounded-xl border border-gold/20 bg-paper/60 px-5 py-12 text-center">
              <h3 className="font-serif text-2xl text-maroon">No designs in this range yet</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-mid">Please explore another price range or check back soon for new wedding cards.</p>
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-maroon/20 bg-paper/50 p-5 text-center">
              <p role="alert" className="text-sm text-maroon">{error}</p>
              <button type="button" onClick={() => void loadPage(failedOffset.current)} disabled={loading} className={`mt-4 ${buttonClass}`}>Try again</button>
            </div>
          )}

          {page && page.nextOffset !== null && !error && (
            <div className="mt-8 text-center">
              <button type="button" onClick={() => void loadPage(page.nextOffset!)} disabled={loading} className={buttonClass}>
                {loading ? "Loading…" : "Load more wedding cards"}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
