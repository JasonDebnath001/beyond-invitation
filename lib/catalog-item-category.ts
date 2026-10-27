import "server-only";

import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildErpProductList,
  compareWeddingCardProducts,
  isWeddingCardProduct,
  mapCatalogRowToProduct,
  resolveCatalogProducts,
  type CatalogProduct,
  type WebProductRow,
} from "@/lib/catalog";
import { applyResellerPricingToProducts } from "@/lib/reseller";
import { PRODUCTS_PER_PAGE } from "@/lib/product-page";
import { readStorefrontPage } from "@/lib/storefront-data";

export type CategorizedCatalogProduct = CatalogProduct & {
  itemCategory: string;
};

async function readPublishedItemCategories(
  itemCategory?: string,
  includeWebCategories = false,
) {
  const admin = getSupabaseAdminClient();
  const categories = new Map<string, string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = admin
      .from("items")
      .select("id,item_categories!inner(name)")
      .eq("show_on_website", true)
      .eq("is_active", true);
    if (itemCategory) query = query.eq("item_categories.name", itemCategory);
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
      .returns<{ id: string; item_categories: { name: string } }[]>();
    if (error) throw new Error(`Item category unavailable: ${error.message}`);
    for (const row of data ?? [])
      categories.set(row.id, row.item_categories.name);
    if ((data?.length ?? 0) < pageSize) break;
  }

  if (includeWebCategories && itemCategory) {
    // Item Category (Web) stores subject IDs in a JSONB array, independently
    // of the ordinary Item Category. Resolve every exact name match first.
    for (let subjectOffset = 0; ; subjectOffset += pageSize) {
      const { data: subjects, error: subjectError } = await admin
        .from("subjects")
        .select("id")
        .eq("name", itemCategory)
        .order("id", { ascending: true })
        .range(subjectOffset, subjectOffset + pageSize - 1)
        .returns<{ id: string }[]>();
      if (subjectError)
        throw new Error(`Web category unavailable: ${subjectError.message}`);

      for (const subject of subjects ?? []) {
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await admin
            .from("items")
            .select("id,item_categories(name)")
            .eq("show_on_website", true)
            .eq("is_active", true)
            .contains("web_category_ids", JSON.stringify([subject.id]))
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1)
            .returns<
              { id: string; item_categories: { name: string } | null }[]
            >();
          if (error)
            throw new Error(`Web category unavailable: ${error.message}`);
          for (const row of data ?? []) {
            if (!categories.has(row.id))
              categories.set(row.id, row.item_categories?.name ?? "");
          }
          if ((data?.length ?? 0) < pageSize) break;
        }
      }
      if ((subjects?.length ?? 0) < pageSize) break;
    }
  }
  return categories;
}

/**
 * The public catalogue view does not yet expose Item Category. Read only the
 * published item IDs through the server client. Product content comes from the
 * public catalogue view, with the same titles and Selling prices as the main catalogue.
 */
const readProductsByItemCategory = unstable_cache(
  async (
    itemCategory: string,
    includeWebCategories = false,
  ): Promise<CategorizedCatalogProduct[]> => {
    const publicCatalog = getSupabaseServerClient();
    const categories = await readPublishedItemCategories(
      itemCategory,
      includeWebCategories,
    );
    const products: CategorizedCatalogProduct[] = [];
    const itemIds = [...categories.keys()];
    // Bound URL length and stay below the database's response-row limit.
    for (let offset = 0; offset < itemIds.length; offset += 100) {
      const { data, error } = await publicCatalog
        .from("v_web_products")
        .select("*")
        .in("id", itemIds.slice(offset, offset + 100))
        .returns<WebProductRow[]>();

      if (error)
        throw new Error(`Product catalogue unavailable: ${error.message}`);
      products.push(
        ...(await resolveCatalogProducts(data ?? [])).map((product) => ({
          ...product,
          itemCategory: categories.get(product.catalogId) ?? "",
        })),
      );
    }

    return products.sort(compareWeddingCardProducts);
  },
  ["products-by-item-category-v8-web-categories"],
  { revalidate: 60, tags: ["catalogue"] },
);

/** Base data for the migration-compatible server pagination path. */
export async function fetchProductsByItemCategoryBase(
  itemCategory: string,
  includeWebCategories = false,
): Promise<CategorizedCatalogProduct[]> {
  const name = itemCategory.trim();
  return name ? readProductsByItemCategory(name, includeWebCategories) : [];
}

const readItemCategoryProductPage = unstable_cache(
  async (
    itemCategory: string,
    offset: number,
  ): Promise<{ products: CatalogProduct[]; nextOffset: number | null }> => {
    const optimized = await readStorefrontPage({
      p_item_category: itemCategory,
      p_offset: offset,
      p_limit: PRODUCTS_PER_PAGE,
      p_sort: "recommended",
    });
    if (optimized !== null) {
      return {
        products: optimized.products.map(mapCatalogRowToProduct),
        nextOffset: optimized.nextOffset,
      };
    }

    const products = await readProductsByItemCategory(itemCategory);
    const end = offset + PRODUCTS_PER_PAGE;
    return {
      products: products.slice(offset, end),
      nextOffset: end < products.length ? end : null,
    };
  },
  ["itemCategoryProductPage-v1", String(PRODUCTS_PER_PAGE)],
  { revalidate: 60, tags: ["catalogue"] },
);

/** Read one category page while keeping visitor prices out of shared caches. */
export async function fetchItemCategoryProductPage(
  itemCategory: string,
  offset = 0,
): Promise<{ products: CatalogProduct[]; nextOffset: number | null }> {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 2147483647 - PRODUCTS_PER_PAGE
  ) {
    throw new Error("Provide a valid product offset.");
  }
  const name = itemCategory.trim();
  if (!name) return { products: [], nextOffset: null };
  const page = await readItemCategoryProductPage(name, offset);
  return {
    products: await applyResellerPricingToProducts(page.products),
    nextOffset: page.nextOffset,
  };
}

const readWeddingCardsWithCategories = unstable_cache(
  async (): Promise<CategorizedCatalogProduct[]> => {
    const [products, categories] = await Promise.all([
      buildErpProductList(),
      readPublishedItemCategories(),
    ]);
    return products
      .map((product) => ({
        ...product,
        itemCategory: categories.get(product.catalogId) ?? "",
      }))
      .filter(
        (product) =>
          product.itemCategory === "Hindu Wedding Card" ||
          product.itemCategory === "Wedding Card" ||
          isWeddingCardProduct(product),
      )
      .sort(compareWeddingCardProducts);
  },
  ["wedding-cards-with-item-categories-v6-web-titles"],
  { revalidate: 60, tags: ["catalogue"] },
);

export async function fetchWeddingCardsWithCategoriesBase(): Promise<
  CategorizedCatalogProduct[]
> {
  return readWeddingCardsWithCategories();
}
