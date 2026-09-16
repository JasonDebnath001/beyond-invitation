"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_WISHLIST_ITEMS, normalizeWishlistSlugs, parseWishlist, WISHLIST_STORAGE_KEY } from "@/lib/wishlist";
import { useAuth } from "./AuthProvider";

const SYNC_KEY = `${WISHLIST_STORAGE_KEY}-sync`;
const EMPTY_SLUGS: string[] = [];

type WishlistContextValue = {
  slugs: string[];
  ready: boolean;
  syncing: boolean;
  signedIn: boolean;
  error: string;
  retry: () => void;
  toggleItem: (slug: string) => void;
  removeItem: (slug: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState({
    owner: userId, slugs: EMPTY_SLUGS, ready: false, syncing: false, error: "",
  });
  const guestMemory = useRef<string[]>([]);
  const actions = useRef({ change: (_slug: string, _remove: boolean) => {}, retry: () => {} });

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    let slugs: string[] = [];
    let loaded = false;
    let busy = false;
    let refreshQueued = false;
    const controller = new AbortController();

    function publish(error = "") {
      if (active) setState({ owner: userId, slugs, ready: loaded, syncing: busy, error });
    }
    function readGuest() {
      try { guestMemory.current = parseWishlist(localStorage.getItem(WISHLIST_STORAGE_KEY)); } catch {
        // Keep guest selections in memory when storage is disabled.
      }
      return guestMemory.current;
    }
    function writeGuest(items: string[]) {
      guestMemory.current = items;
      try { localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items)); } catch {}
    }
    function broadcast() {
      try { localStorage.setItem(SYNC_KEY, JSON.stringify({ userId, nonce: Math.random() })); } catch {}
    }
    async function request(method: string, body?: object) {
      const response = await fetch("/api/wishlist", {
        method, cache: "no-store", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-wishlist-user": userId! },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sync your wishlist. Please try again.");
      if (data.userId !== userId || !Array.isArray(data.slugs)) {
        throw new Error("Your account changed. Please reload your wishlist.");
      }
      return { slugs: normalizeWishlistSlugs(data.slugs), unmergedSlugs: normalizeWishlistSlugs(data.unmergedSlugs) };
    }
    function finish(error: string) {
      busy = false;
      publish(error);
      if (active && refreshQueued) {
        refreshQueued = false;
        void refresh();
      }
    }
    async function refresh() {
      if (!active) return;
      if (!userId) {
        slugs = readGuest();
        loaded = true;
        publish();
        return;
      }
      if (busy) { refreshQueued = true; return; }
      busy = true;
      publish();
      let message = "";
      try {
        const saved = await request("GET");
        if (!active) return;
        slugs = saved.slugs;
        loaded = true;
        const guest = readGuest();
        if (guest.length) {
          const merged = await request("POST", { slugs: guest });
          if (!active) return;
          slugs = merged.slugs;
          // Preserve guest additions from another tab while the merge was in flight.
          writeGuest(normalizeWishlistSlugs([
            ...readGuest().filter((slug) => !guest.includes(slug)), ...merged.unmergedSlugs,
          ]));
          if (merged.unmergedSlugs.length) {
            message = "Your wishlist is full. Some device items could not be synced. Remove an item, then retry.";
          }
          if (guest.some((slug) => !merged.unmergedSlugs.includes(slug))) broadcast();
        }
      } catch (error) {
        message = error instanceof Error ? error.message : "Unable to load your wishlist. Please try again.";
      } finally { finish(message); }
    }
    async function change(slug: string, remove: boolean) {
      if (!active || !loaded || busy || !normalizeWishlistSlugs([slug]).length) return;
      slug = slug.trim();
      const exists = slugs.includes(slug);
      if (remove && !exists) return;
      const deleting = remove || exists;
      if (!deleting && slugs.length >= MAX_WISHLIST_ITEMS) return;
      const previous = slugs;
      slugs = deleting ? slugs.filter((item) => item !== slug) : [...slugs, slug];
      if (!userId) {
        writeGuest(slugs);
        publish();
        return;
      }
      busy = true;
      publish();
      let message = "";
      try {
        const saved = await request(deleting ? "DELETE" : "POST", { slug });
        if (!active) return;
        slugs = saved.slugs;
        broadcast();
      } catch (error) {
        slugs = previous;
        message = error instanceof Error ? error.message : "Unable to save your wishlist. Please try again.";
      } finally { finish(message); }
    }
    function syncStorage(event: StorageEvent) {
      if (event.key === WISHLIST_STORAGE_KEY || event.key === null || (userId && event.key === SYNC_KEY)) {
        // Signed-in tabs merge device changes on focus/retry, avoiding merge loops.
        if (!userId || event.key !== WISHLIST_STORAGE_KEY) void refresh();
      }
    }
    const onFocus = () => { void refresh(); };
    actions.current = { change: (slug, remove) => { void change(slug, remove); }, retry: onFocus };
    void refresh();
    window.addEventListener("storage", syncStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [authReady, userId]);

  // Hide the previous account's data immediately, before the effect runs.
  const current = authReady && state.owner === userId;
  const value: WishlistContextValue = {
    slugs: current ? state.slugs : EMPTY_SLUGS,
    ready: current && state.ready,
    syncing: current && state.syncing,
    signedIn: !!userId,
    error: current ? state.error : "",
    retry: () => actions.current.retry(),
    toggleItem: (slug) => { if (current && state.ready) actions.current.change(slug, false); },
    removeItem: (slug) => { if (current && state.ready) actions.current.change(slug, true); },
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
      {value.error && (
        <div role="alert" className="fixed bottom-5 left-4 right-4 z-[100] mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-4 text-sm text-red-800 shadow-lg">
          <p>{value.error}</p>
          <button type="button" onClick={value.retry} disabled={value.syncing} className="mt-2 underline disabled:opacity-50">Retry sync</button>
          {value.ready && <button type="button" onClick={() => setState((currentState) => ({ ...currentState, error: "" }))} className="ml-4 underline">Dismiss</button>}
        </div>
      )}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return context;
}
