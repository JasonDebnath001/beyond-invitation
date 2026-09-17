"use client";

import { Suspense, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWishlist } from "@/components/WishlistProvider";
import {
  parseSharedSlugs,
  sortWishlistProducts,
  type WishlistSortKey,
} from "@/lib/wishlist";
import type { Product } from "@/types";
import WishlistCard from "@/components/wishlist/WishlistCard";
import {
  WishlistMotion,
  useWishlistMotion,
} from "@/components/wishlist/WishlistMotion";
import WishlistSkeleton from "@/components/wishlist/WishlistSkeleton";
import WishlistEmpty from "@/components/wishlist/WishlistEmpty";
import WishlistToolbar from "@/components/wishlist/WishlistToolbar";
import UnavailableItems from "@/components/wishlist/UnavailableItems";
import SharedShortlist from "@/components/wishlist/SharedShortlist";
import { useWishlistProducts } from "@/components/wishlist/useWishlistProducts";
import {
  contentClass,
  gridClass,
  secondaryClass,
  WishlistHeader,
  WishlistError,
} from "@/components/wishlist/WishlistUI";

function PersonalContent({
  products,
  loading,
  error,
  retry,
  sortKey,
  setSortKey,
}: {
  products: Product[];
  loading: boolean;
  error: string;
  retry: () => void;
  sortKey: WishlistSortKey;
  setSortKey: (key: WishlistSortKey) => void;
}) {
  const wishlist = useWishlist();
  const current = useRef(wishlist);
  current.current = wishlist;
  const motion = useWishlistMotion();
  const [removing, setRemoving] = useState<string | null>(null);
  const removeLock = useRef(false);
  useLayoutEffect(() => motion.reorderEnd(), [sortKey, motion]);
  const missingSlugs = wishlist.slugs.filter(
    (slug) => !products.some((product) => product.slug === slug),
  );
  const busy = wishlist.syncing || removing !== null;

  function remove(slug: string, element: HTMLElement) {
    if (busy || removeLock.current) return;
    removeLock.current = true;
    setRemoving(slug);
    motion.removeCard(element, () => {
      const latest = current.current;
      if (
        element.isConnected &&
        latest.ready &&
        !latest.syncing &&
        latest.slugs.includes(slug)
      )
        latest.removeItem(slug);
      removeLock.current = false;
      setRemoving(null);
    });
  }

  return (
    <main className={contentClass}>
      <WishlistHeader
        count={wishlist.slugs.length}
        ready={wishlist.ready}
        signedIn={wishlist.signedIn}
      />
      {wishlist.ready && !wishlist.signedIn && wishlist.slugs.length > 0 && (
        <div
          data-motion="nudge"
          className="mb-7 rounded-2xl border border-gold/20 bg-white/80 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-5"
        >
          <div>
            <p className="text-sm font-semibold text-carbon">
              Keep this list on every device.
            </p>
            <p className="mt-1 text-sm text-ink-mid">
              Sign in and your saved designs come with you.
            </p>
          </div>
          <Link
            href="/sign-in?next=%2Fwishlist"
            className={`mt-4 shrink-0 sm:mt-0 ${secondaryClass}`}
          >
            Sign in
          </Link>
        </div>
      )}
      {!wishlist.ready && wishlist.error ? (
        <WishlistError
          message="We could not load your saved wishlist."
          onRetry={wishlist.retry}
          disabled={wishlist.syncing}
          alert={false}
        />
      ) : !wishlist.ready || loading ? (
        <WishlistSkeleton />
      ) : error ? (
        <WishlistError message={error} onRetry={retry} />
      ) : wishlist.slugs.length === 0 ? (
        <WishlistEmpty />
      ) : (
        <>
          <WishlistToolbar
            products={products}
            slugs={wishlist.slugs}
            sortKey={sortKey}
            disabled={busy}
            onSort={(key) => {
              motion.reorderStart();
              setSortKey(key);
            }}
          />
          <div className={gridClass}>
            {products.map((product) => (
              <WishlistCard
                key={product.slug}
                product={product}
                onRemove={remove}
                disabled={busy}
              />
            ))}
          </div>
          <UnavailableItems slugs={missingSlugs} />
        </>
      )}
    </main>
  );
}

function PersonalWishlist() {
  const { slugs, ready } = useWishlist();
  const lookup = useWishlistProducts(slugs, ready);
  const [sortKey, setSortKey] = useState<WishlistSortKey>("recent");
  const products = sortWishlistProducts(lookup.products, slugs, sortKey);
  const phase =
    !ready || lookup.loading
      ? "loading"
      : lookup.error
        ? "error"
        : slugs.length
          ? "products"
          : "empty";
  return (
    <WishlistMotion
      count={slugs.length}
      renderedSlugs={
        phase === "products" ? products.map(({ slug }) => slug) : []
      }
      phase={phase}
    >
      <PersonalContent
        {...lookup}
        products={products}
        sortKey={sortKey}
        setSortKey={setSortKey}
      />
    </WishlistMotion>
  );
}

function WishlistRoute() {
  const params = useSearchParams();
  return params.has("items") ? (
    <SharedShortlist slugs={parseSharedSlugs(params.get("items"))} />
  ) : (
    <PersonalWishlist />
  );
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<WishlistSkeleton page />}>
      <WishlistRoute />
    </Suspense>
  );
}
