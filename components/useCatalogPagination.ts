"use client";

import { useEffect, useRef, useState } from "react";
import {
  catalogBrowseQuery,
  emptyCatalogPage,
  type CatalogBrowsePage,
  type CatalogPrice,
  type CatalogScope,
  type CatalogSort,
} from "@/lib/catalog-browse-options";

const DEFAULT_FILTERS = { price: "all", sort: "featured" } as const;
type Filters = { price: CatalogPrice; sort: CatalogSort };
type PageRequest = { query: string; offset: number; mode: "replace" | "append" };

export function useCatalogPagination(initialPage: CatalogBrowsePage, scope: CatalogScope = {}) {
  const scopeQuery = catalogBrowseQuery(scope);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState<PageRequest["mode"] | null>(null);
  const [error, setError] = useState("");
  const pageRef = useRef(initialPage);
  const filtersRef = useRef<Filters>(DEFAULT_FILTERS);
  const queryRef = useRef(scopeQuery);
  const controllerRef = useRef<AbortController | null>(null);
  const failedRequestRef = useRef<PageRequest | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    failedRequestRef.current = null;
    pageRef.current = initialPage;
    filtersRef.current = DEFAULT_FILTERS;
    queryRef.current = scopeQuery;
    setPage(initialPage);
    setFilters(DEFAULT_FILTERS);
    setLoading(null);
    setError("");
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [initialPage, scopeQuery]);

  async function requestPage(request: PageRequest) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    failedRequestRef.current = null;
    setError("");
    setLoading(request.mode);
    if (request.mode === "replace") {
      pageRef.current = emptyCatalogPage();
      setPage(pageRef.current);
    }

    try {
      const response = await fetch(`/api/catalog/browse?${request.query}&offset=${request.offset}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Catalogue unavailable");
      const result = await response.json() as CatalogBrowsePage;
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      if (
        !Array.isArray(result.products) || !Number.isSafeInteger(result.total) || result.total < 0 ||
        !(result.nextOffset === null || (Number.isSafeInteger(result.nextOffset) && result.nextOffset > request.offset))
      ) throw new Error("Invalid catalogue page");

      const products = request.mode === "append" ? [...pageRef.current.products] : [];
      const seen = new Set(products.map((product) => product.slug));
      for (const product of result.products) {
        if (!seen.has(product.slug)) {
          seen.add(product.slug);
          products.push(product);
        }
      }
      pageRef.current = { ...result, products };
      setPage(pageRef.current);
    } catch {
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      failedRequestRef.current = request;
      setError("We couldn't load these products. Please try again.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(null);
      }
    }
  }

  function changeFilters(next: Filters) {
    const query = catalogBrowseQuery(scope, next.price, next.sort);
    if (query === queryRef.current) return;
    queryRef.current = query;
    filtersRef.current = next;
    setFilters(next);
    void requestPage({ query, offset: 0, mode: "replace" });
  }

  return {
    page, loading, error, ...filters,
    setPrice: (price: CatalogPrice) => changeFilters({ ...filtersRef.current, price }),
    setSort: (sort: CatalogSort) => changeFilters({ ...filtersRef.current, sort }),
    clearFilters: () => changeFilters(DEFAULT_FILTERS),
    loadMore() {
      if (controllerRef.current || pageRef.current.nextOffset === null) return;
      void requestPage({ query: queryRef.current, offset: pageRef.current.nextOffset, mode: "append" });
    },
    retry() {
      if (!controllerRef.current && failedRequestRef.current) void requestPage(failedRequestRef.current);
    },
  };
}
