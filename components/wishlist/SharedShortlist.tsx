"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import { sortWishlistProducts, type WishlistSortKey } from "@/lib/wishlist";
import { WishlistMotion, useWishlistMotion } from "./WishlistMotion";
import WishlistCard from "./WishlistCard";
import WishlistSkeleton from "./WishlistSkeleton";
import WishlistEmpty from "./WishlistEmpty";
import WishlistToolbar from "./WishlistToolbar";
import { useWishlistProducts } from "./useWishlistProducts";
import { contentClass, gridClass, secondaryClass, WishlistHeader, WishlistError } from "./WishlistUI";

function SharedContent({ slugs, products, loading, error, retry, sortKey, setSortKey }: {
  slugs: string[]; products: Product[]; loading: boolean; error: string; retry: () => void;
  sortKey: WishlistSortKey; setSortKey: (key: WishlistSortKey) => void;
}) {
  const motion = useWishlistMotion();
  useLayoutEffect(() => motion.reorderEnd(), [sortKey, motion]);
  return (
    <main className={contentClass}>
      <WishlistHeader shared count={products.length} ready={!loading} />
      <Link href="/wishlist" className={`mb-7 ${secondaryClass}`}>Go to my wishlist</Link>
      {loading ? <WishlistSkeleton /> : error ? <WishlistError message={error} onRetry={retry} /> : products.length ? (
        <>
          <WishlistToolbar shared products={products} slugs={slugs} sortKey={sortKey} onSort={(key) => { motion.reorderStart(); setSortKey(key); }} />
          <div className={gridClass}>{products.map((product) => <WishlistCard key={product.slug} product={product} mode="shared" />)}</div>
        </>
      ) : <WishlistEmpty shared />}
    </main>
  );
}

export default function SharedShortlist({ slugs }: { slugs: string[] }) {
  const lookup = useWishlistProducts(slugs, true);
  const [sortKey, setSortKey] = useState<WishlistSortKey>("recent");
  const products = sortWishlistProducts(lookup.products, slugs, sortKey);
  const phase = lookup.loading ? "loading" : lookup.error ? "error" : products.length ? "products" : "empty";
  return (
    <WishlistMotion count={products.length} renderedSlugs={phase === "products" ? products.map(({ slug }) => slug) : []} phase={phase}>
      <SharedContent {...lookup} products={products} slugs={slugs} sortKey={sortKey} setSortKey={setSortKey} />
    </WishlistMotion>
  );
}
