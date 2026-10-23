import "server-only";
import { unstable_cache } from "next/cache";
import { discountPercent } from "@/types";
import {
  fetchErpProductsBase,
  mapCatalogRowToProduct,
  isWeddingCardProduct,
  compareWeddingCardProducts,
  type CatalogProduct,
} from "@/lib/catalog";
import {
  fetchProductsByItemCategoryBase,
  fetchWeddingCardsWithCategoriesBase,
} from "@/lib/catalog-item-category";
import {
  readStorefrontPage,
  type StorefrontPageQuery,
} from "@/lib/storefront-data";
import {
  applyMarginToPrice,
  getActiveResellerFromCookies,
  repriceProduct,
} from "@/lib/reseller";
import {
  COLLECTION_PAGE_SIZE,
  CATALOG_PRICES,
  CATALOG_SORTS,
  type CatalogBrowseOptions,
  type CatalogBrowsePage,
} from "@/lib/catalog-browse-options";
import {
  CARD_TYPES,
  PRICE_BUCKETS,
  DEFAULT_WEDDING_FILTERS,
  applyWeddingFilters,
  sortWeddingProducts,
  facetCounts,
  normalizeWeddingCollectionFilters,
  type BrowserProduct,
  type WeddingFilters,
  type WeddingCollectionType,
  type WeddingProductPage,
} from "@/lib/wedding-cards";

function validateOffset(offset: number) {
  // The PostgreSQL page function uses an integer offset.
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 2147483647 - COLLECTION_PAGE_SIZE
  )
    throw new Error("Provide a valid product offset.");
}

function forDisplay(product: CatalogProduct, margin: number) {
  return {
    ...product,
    price: applyMarginToPrice(product.price, margin),
    mrp: applyMarginToPrice(product.mrp, margin),
  };
}

function summary(product: CatalogProduct): CatalogProduct {
  return {
    ...product,
    imageCount: product.images.length,
    images: product.images.slice(0, 1),
    videos: [],
    description: "",
    dimensions: undefined,
  };
}

function browserProduct(product: CatalogProduct): BrowserProduct {
  return {
    slug: product.slug,
    designNo: product.itemCode || product.slug,
    name: product.name,
    printName: product.printName,
    price: product.price,
    mrp: product.mrp,
    image: product.images[0] || "",
    imageCount: product.images.length,
    subject: product.subject,
    itemCategory: product.itemCategory ?? "",
    itemGroup: product.itemGroup,
    hasPrice: product.hasPrice,
    minOrderQty: product.minOrderQty,
    updatedAt: product.updatedAt,
  };
}

function genericPriceBounds(
  price: string,
): Pick<StorefrontPageQuery, "p_price_min" | "p_price_max"> {
  switch (price) {
    case "under-100":
      return { p_price_min: 0, p_price_max: 100 };
    case "100-300":
      return { p_price_min: 100, p_price_max: 300 };
    case "300-1000":
      return { p_price_min: 300, p_price_max: 1000 };
    case "above-1000":
      return { p_price_min: 1000 };
    default:
      return {};
  }
}

const readCatalogBrowsePage = unstable_cache(
  async (
    options: Required<Pick<CatalogBrowseOptions, "offset" | "price" | "sort">> &
      Pick<CatalogBrowseOptions, "category" | "subjects">,
    margin: number,
  ): Promise<CatalogBrowsePage> => {
    const bounds = genericPriceBounds(options.price);
    const result = await readStorefrontPage({
      p_offset: options.offset,
      p_limit: COLLECTION_PAGE_SIZE,
      p_margin_percent: margin,
      p_sort:
        options.sort === "featured"
          ? options.category === "wedding"
            ? "recommended"
            : "catalogue"
          : options.sort === "discount"
            ? "discount"
            : `generic-${options.sort}`,
      ...(options.category === "wedding"
        ? { p_wedding_only: true }
        : { p_category: options.category }),
      p_subjects: options.subjects,
      ...bounds,
    });
    if (result !== null)
      return {
        products: result.products.map(mapCatalogRowToProduct).map(summary),
        total: result.total,
        nextOffset: result.nextOffset,
      };

    // Temporary compatibility until the migration is applied. Filtering still
    // runs on the entire scoped set before slicing; the client only gets a page.
    let source = await fetchErpProductsBase();
    if (options.category)
      source = source.filter(
        options.category === "wedding"
          ? isWeddingCardProduct
          : (p) => p.category === options.category,
      );
    if (options.category === "wedding")
      source = [...source].sort(compareWeddingCardProducts);
    if (options.subjects?.length)
      source = source.filter((p) =>
        options.subjects!.includes(p.subject.trim().toLowerCase()),
      );
    const filtered = source
      .map((base) => ({ base, shown: forDisplay(base, margin) }))
      .filter(
        ({ shown }) =>
          (bounds.p_price_min === undefined ||
            shown.price >= bounds.p_price_min) &&
          (bounds.p_price_max === undefined ||
            shown.price < bounds.p_price_max),
      );
    if (options.sort === "price-asc")
      filtered.sort((a, b) => a.shown.price - b.shown.price);
    if (options.sort === "price-desc")
      filtered.sort((a, b) => b.shown.price - a.shown.price);
    if (options.sort === "discount")
      filtered.sort(
        (a, b) => discountPercent(b.shown) - discountPercent(a.shown),
      );
    const end = options.offset + COLLECTION_PAGE_SIZE;
    return {
      products: filtered
        .slice(options.offset, end)
        .map(({ base }) => summary(base)),
      nextOffset: end < filtered.length ? end : null,
      total: filtered.length,
    };
  },
  ["catalogBrowsePage-v2"],
  { revalidate: 60, tags: ["catalogue"] },
);

export async function fetchCatalogProductPage(
  options: CatalogBrowseOptions = {},
): Promise<CatalogBrowsePage> {
  const offset = options.offset ?? 0;
  validateOffset(offset);
  const reseller = await getActiveResellerFromCookies();
  const page = await readCatalogBrowsePage(
    {
      offset,
      price: CATALOG_PRICES.includes(options.price!) ? options.price! : "all",
      sort: CATALOG_SORTS.includes(options.sort!) ? options.sort! : "featured",
      ...(options.category ? { category: options.category } : {}),
      ...(options.subjects?.length
        ? {
            subjects: [
              ...new Set(options.subjects.map((s) => s.trim().toLowerCase())),
            ].sort(),
          }
        : {}),
    },
    reseller?.marginPercent ?? 0,
  );
  return {
    ...page,
    products: reseller
      ? page.products.map((p) => repriceProduct(p, reseller))
      : page.products,
  };
}

function weddingPriceBounds(
  price: WeddingFilters["price"],
): StorefrontPageQuery {
  switch (price) {
    case "under-25":
      return { p_priced_only: true, p_price_max: 25 };
    case "25-50":
      return { p_price_min: 25, p_price_max: 50 };
    case "50-100":
      return { p_price_min: 50, p_price_max: 100, p_price_max_inclusive: true };
    case "above-100":
      return { p_price_min: 100, p_price_min_exclusive: true };
    case "on-request":
      return { p_on_request: true };
    default:
      return {};
  }
}

const readWeddingBrowsePage = unstable_cache(
  async (
    collectionType: WeddingCollectionType | null,
    filters: WeddingFilters,
    offset: number,
    margin: number,
  ) => {
    const itemCategory =
      collectionType === "boxes"
        ? "Wedding Box"
        : CARD_TYPES.find((t) => t.value === collectionType)?.itemCategory;
    const filterCategory = !collectionType
      ? CARD_TYPES.find((t) => t.value === filters.type)?.itemCategory
      : undefined;
    const pricedOnly = collectionType === "hindu";
    const result = await readStorefrontPage({
      p_offset: offset,
      p_limit: COLLECTION_PAGE_SIZE,
      p_sort: filters.sort,
      p_margin_percent: margin,
      p_item_category: itemCategory,
      p_wedding_collection: !collectionType,
      p_filter_item_category: filterCategory,
      p_include_facets: true,
      ...weddingPriceBounds(filters.price),
      ...(pricedOnly ? { p_priced_only: true } : {}),
    });
    if (result !== null) {
      if (!result.facets)
        throw new Error("Product catalogue returned no filter counts.");
      // The RPC counts facets before applying price filters. Hindu's entire
      // collection is priced-only, including its All prices count and options.
      const facetTotal =
        result.facets.total -
        (pricedOnly ? (result.facets.prices["on-request"] ?? 0) : 0);
      const prices = PRICE_BUCKETS.filter(
        (bucket) => !pricedOnly || bucket.value !== "on-request",
      )
        .map((bucket) => ({
          ...bucket,
          count: result.facets!.prices[bucket.value] ?? 0,
        }))
        .filter((b) => b.count > 0);
      return {
        products: result.products.map(mapCatalogRowToProduct),
        nextOffset: result.nextOffset,
        total: result.total,
        facets: {
          total: facetTotal,
          types: CARD_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
            count: pricedOnly
              ? t.value === "hindu"
                ? facetTotal
                : 0
              : (result.facets!.types[t.value] ?? 0),
          })),
          prices,
          showPrice: prices.length >= 2,
        },
      };
    }
    const source = itemCategory
      ? await fetchProductsByItemCategoryBase(itemCategory)
      : await fetchWeddingCardsWithCategoriesBase();
    const displayed = source
      .map((p) => browserProduct(forDisplay(p, margin)))
      .filter(
        (product) =>
          !pricedOnly || (Number.isFinite(product.price) && product.price > 0),
      );
    const matches = sortWeddingProducts(
      applyWeddingFilters(displayed, filters),
      filters.sort,
    );
    const bySlug = new Map(source.map((p) => [p.slug, p]));
    const end = offset + COLLECTION_PAGE_SIZE;
    return {
      products: matches.slice(offset, end).map((p) => bySlug.get(p.slug)!),
      nextOffset: end < matches.length ? end : null,
      total: matches.length,
      facets: facetCounts(displayed),
    };
  },
  ["weddingBrowsePage-v3-hindu-priced"],
  { revalidate: 60, tags: ["catalogue"] },
);

export async function fetchWeddingProductPage({
  collectionType,
  filters = DEFAULT_WEDDING_FILTERS,
  offset = 0,
}: {
  collectionType?: WeddingCollectionType;
  filters?: WeddingFilters;
  offset?: number;
} = {}): Promise<WeddingProductPage> {
  validateOffset(offset);
  const reseller = await getActiveResellerFromCookies();
  const page = await readWeddingBrowsePage(
    collectionType ?? null,
    normalizeWeddingCollectionFilters(filters, collectionType),
    offset,
    reseller?.marginPercent ?? 0,
  );
  return {
    ...page,
    products: page.products.map((p) =>
      browserProduct(reseller ? repriceProduct(p, reseller) : p),
    ),
  };
}
