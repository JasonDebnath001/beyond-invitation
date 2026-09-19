import "server-only";

import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildErpProductList,
  compareWeddingCardProducts,
  isWeddingCardProduct,
  mapCatalogRowToProduct,
  type CatalogProduct,
  type WebProductRow,
} from "@/lib/catalog";
import { applyResellerPricingToProducts } from "@/lib/reseller";

export type CategorizedCatalogProduct = CatalogProduct & { itemCategory: string };

async function readPublishedItemCategories(itemCategory?: string) {
  const admin = getSupabaseAdminClient();
  const categories = new Map<string, string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = admin.from("items").select("id,item_categories!inner(name)")
      .eq("show_on_website", true).eq("is_active", true);
    if (itemCategory) query = query.eq("item_categories.name", itemCategory);
    const { data, error } = await query.order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
      .returns<{ id: string; item_categories: { name: string } }[]>();
    if (error) throw new Error(`Item category unavailable: ${error.message}`);
    for (const row of data ?? []) categories.set(row.id, row.item_categories.name);
    if ((data?.length ?? 0) < pageSize) break;
  }
  return categories;
}

/**
 * The public catalogue view does not yet expose Item Category. Read only the
 * published item IDs through the server client; all product content and prices
 * must still come from the restricted public catalogue view.
 */
const readProductsByItemCategory = unstable_cache(
  async (itemCategory: string): Promise<CategorizedCatalogProduct[]> => {
    const publicCatalog = getSupabaseServerClient();
    const categories = await readPublishedItemCategories(itemCategory);
    const products: CategorizedCatalogProduct[] = [];
    const itemIds = [...categories.keys()];
    // Bound URL length and stay below the database's response-row limit.
    for (let offset = 0; offset < itemIds.length; offset += 100) {
      const { data, error } = await publicCatalog
        .from("v_web_products")
        .select("*")
        .in("id", itemIds.slice(offset, offset + 100))
        .returns<WebProductRow[]>();

      if (error) throw new Error(`Product catalogue unavailable: ${error.message}`);
      products.push(...(data ?? []).map((row) => ({
        ...mapCatalogRowToProduct(row),
        itemCategory: categories.get(row.id) ?? "",
      })));
    }

    return products.sort(compareWeddingCardProducts);
  },
  ["products-by-item-category-v2"],
  { revalidate: 60, tags: ["catalogue"] },
);

export async function fetchProductsByItemCategory(itemCategory: string): Promise<CategorizedCatalogProduct[]> {
  const name = itemCategory.trim();
  if (!name) return [];
  // Visitor-specific prices are never included in the shared category cache.
  return applyResellerPricingToProducts(await readProductsByItemCategory(name));
}

const readWeddingCardsWithCategories = unstable_cache(
  async (): Promise<CategorizedCatalogProduct[]> => {
    const [products, categories] = await Promise.all([
      buildErpProductList(), readPublishedItemCategories(),
    ]);
    return products.map((product) => ({
      ...product,
      itemCategory: categories.get(product.catalogId) ?? "",
    })).filter((product) =>
      product.itemCategory === "Hindu Wedding Card" ||
      product.itemCategory === "Wedding Card" ||
      isWeddingCardProduct(product),
    ).sort(compareWeddingCardProducts);
  },
  ["wedding-cards-with-item-categories-v1"],
  { revalidate: 60, tags: ["catalogue"] },
);

export async function fetchWeddingCardsWithCategories(): Promise<CategorizedCatalogProduct[]> {
  return applyResellerPricingToProducts(await readWeddingCardsWithCategories());
}
