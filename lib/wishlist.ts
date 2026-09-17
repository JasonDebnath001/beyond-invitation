import type { Product } from "@/types";

export const WISHLIST_STORAGE_KEY = "beyond-invitation-wishlist-v1";
export const MAX_WISHLIST_ITEMS = 500;

export function normalizeWishlistSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter(
          (slug): slug is string =>
            typeof slug === "string" &&
            slug.trim().length > 0 &&
            slug.trim().length <= 200,
        )
        .map((slug) => slug.trim()),
    ),
  ).slice(0, MAX_WISHLIST_ITEMS);
}

export function parseWishlist(value: string | null): string[] {
  try {
    return normalizeWishlistSlugs(value ? JSON.parse(value) : []);
  } catch {
    return [];
  }
}

export type WishlistSortKey = "recent" | "price-asc" | "price-desc" | "name";

export function sortWishlistProducts<T extends Product>(
  products: T[],
  slugs: string[],
  sortKey: WishlistSortKey = "recent",
): T[] {
  const positions = new Map(slugs.map((slug, index) => [slug, index]));
  const recent = (a: T, b: T) =>
    (positions.get(b.slug) ?? -1) - (positions.get(a.slug) ?? -1);
  return [...products].sort((a, b) => {
    if (sortKey === "name")
      return (
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
        recent(a, b)
      );
    if (sortKey === "price-asc" || sortKey === "price-desc") {
      const aPriced = Number.isFinite(a.price) && a.price > 0;
      const bPriced = Number.isFinite(b.price) && b.price > 0;
      if (aPriced !== bPriced) return aPriced ? -1 : 1;
      if (aPriced && bPriced)
        return (
          (sortKey === "price-asc" ? a.price - b.price : b.price - a.price) ||
          recent(a, b)
        );
    }
    return recent(a, b);
  });
}

export function parseSharedSlugs(param: unknown): string[] {
  return typeof param === "string"
    ? normalizeWishlistSlugs(param.split(",")).slice(0, 40)
    : [];
}

export function buildWishlistShareUrl(origin: string, slugs: string[]): string {
  const items = normalizeWishlistSlugs(slugs).slice(0, 40).join(",");
  return `${origin.replace(/\/+$/, "")}/wishlist?items=${encodeURIComponent(items)}`;
}
