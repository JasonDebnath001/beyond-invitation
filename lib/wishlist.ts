export const WISHLIST_STORAGE_KEY = "beyond-invitation-wishlist-v1";
export const MAX_WISHLIST_ITEMS = 500;

export function normalizeWishlistSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(
    (slug): slug is string => typeof slug === "string" && slug.trim().length > 0 && slug.trim().length <= 200,
  ).map((slug) => slug.trim()))).slice(0, MAX_WISHLIST_ITEMS);
}

export function parseWishlist(value: string | null): string[] {
  try {
    return normalizeWishlistSlugs(value ? JSON.parse(value) : []);
  } catch {
    return [];
  }
}
