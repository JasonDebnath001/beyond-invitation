import type { Product, ProductCategory } from "@/types";
import DOMPurify from "isomorphic-dompurify";

const ERPNEXT_URL = process.env.ERPNEXT_URL ?? "";
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY ?? "";
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET ?? "";
const ERPNEXT_PRICE_LIST = process.env.ERPNEXT_PRICE_LIST ?? "Standard Selling";

// Fieldname (NOT the form label) of the "Show on Website" checkbox on Item.
// Override with ERPNEXT_WEBSITE_FIELD in .env.local if yours differs.
const ERPNEXT_WEBSITE_FIELD =
  process.env.ERPNEXT_WEBSITE_FIELD ?? "custom_show_on_website";

// Fieldname of the "Subject" field on Item — used to split Wedding Cards into
// Hindu / Muslim / Christian. Override with ERPNEXT_SUBJECT_FIELD if needed.
const ERPNEXT_SUBJECT_FIELD =
  process.env.ERPNEXT_SUBJECT_FIELD ?? "custom_subject";

// Caching for ERPNext responses (seconds). Set to 0 in .env.local for
// always-fresh data while testing; 60 is a good production default.
const ERPNEXT_REVALIDATE = Number(
  process.env.ERPNEXT_REVALIDATE_SECONDS ?? "60",
);

// --- Multi-image gallery (the "Item Image" child table on Item) -------------
// All three auto-detect by default; set them only if detection misfires.
// ERPNEXT_IMAGE_TABLE_FIELD = the table's fieldname on Item (parentfield).
// ERPNEXT_IMAGE_ROW_FIELD   = the image column inside each row (usually "image").
// ERPNEXT_IMAGE_ORDER_FIELD = the numeric order column inside each row.
const ERPNEXT_IMAGE_TABLE_FIELD = process.env.ERPNEXT_IMAGE_TABLE_FIELD ?? "";
const ERPNEXT_IMAGE_ROW_FIELD = process.env.ERPNEXT_IMAGE_ROW_FIELD ?? "image";
const ERPNEXT_IMAGE_ORDER_FIELD = process.env.ERPNEXT_IMAGE_ORDER_FIELD ?? "";

type ErpNextListResponse<T> = {
  data: T[];
};

type ErpNextSingleResponse<T> = {
  data: T;
};

type ErpItem = {
  name: string;
  item_code: string;
  item_name: string;
  item_group?: string;
  description?: string;
  image?: string;
  disabled?: 0 | 1;
  standard_rate?: number;
  valuation_rate?: number;

  [key: string]: unknown;
};

type ErpItemPrice = {
  name: string;
  item_code: string;
  price_list: string;
  price_list_rate: number;
  currency?: string;
};

export type ErpProduct = Product & {
  itemCode: string;
  itemGroup: string;
  erpName: string;
  /** Value of the ERPNext "Subject" field, e.g. "Hindu" / "Muslim". */
  subject: string;
};

function requireErpConfig() {
  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    throw new Error(
      "ERPNext environment variables are missing. Please set ERPNEXT_URL, ERPNEXT_API_KEY and ERPNEXT_API_SECRET in .env.local.",
    );
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
    "Content-Type": "application/json",
  };
}

function cleanBaseUrl() {
  return ERPNEXT_URL.replace(/\/$/, "");
}

function buildErpUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${cleanBaseUrl()}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(itemGroup?: string): ProductCategory {
  const group = (itemGroup ?? "").toLowerCase();

  if (group.includes("luxe") || group.includes("luxury")) return "luxe";
  if (group.includes("house")) return "housewarming";
  if (group.includes("thread")) return "thread-ceremony";
  if (group.includes("naming")) return "naming-ceremony";
  if (group.includes("birthday")) return "birthday";
  if (group.includes("baby")) return "baby-shower";

  return "wedding";
}

function buildImageUrl(image?: string): string[] {
  if (!image) return [];

  const cleanImage = image.trim();

  if (!cleanImage) return [];

  if (cleanImage.startsWith("http://") || cleanImage.startsWith("https://")) {
    return [encodeURI(cleanImage)];
  }

  if (cleanImage.startsWith("/")) {
    return [encodeURI(`${cleanBaseUrl()}${cleanImage}`)];
  }

  return [encodeURI(`${cleanBaseUrl()}/${cleanImage}`)];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function erpFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path, params), {
    headers: authHeaders(),
    next: { revalidate: ERPNEXT_REVALIDATE },
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `ERPNext API failed: ${res.status} ${res.statusText}. ${errorText}`,
    );
  }

  return res.json() as Promise<T>;
}

async function fetchItemPrices(itemCodes: string[]) {
  if (itemCodes.length === 0) return new Map<string, number>();

  const priceMap = new Map<string, number>();

  // Small chunks prevent nginx 414 Request-URI Too Large error
  const chunks = chunkArray(itemCodes, 25);

  for (const chunk of chunks) {
    const filters = [
      ["Item Price", "item_code", "in", chunk],
      ["Item Price", "price_list", "=", ERPNEXT_PRICE_LIST],
      ["Item Price", "selling", "=", 1],
    ];

    const json = await erpFetch<ErpNextListResponse<ErpItemPrice>>(
      "/api/resource/Item Price",
      {
        fields: JSON.stringify([
          "name",
          "item_code",
          "price_list",
          "price_list_rate",
          "currency",
        ]),
        filters: JSON.stringify(filters),
        limit_page_length: "100",
      },
    );

    for (const price of json.data) {
      priceMap.set(price.item_code, Number(price.price_list_rate || 0));
    }
  }

  return priceMap;
}

function mapErpItemToProduct(
  item: ErpItem,
  priceMap: Map<string, number>,
): ErpProduct {
  const itemCode = item.item_code || item.name;
  const priceFromItemPrice = priceMap.get(itemCode);

  const price = Number(
    priceFromItemPrice || item.standard_rate || item.valuation_rate || 0,
  );

  const mrp = price;

  return {
    erpName: item.name,
    itemCode,
    itemGroup: item.item_group ?? "",
    subject: String(item[ERPNEXT_SUBJECT_FIELD] ?? "").trim(),

    slug: normalizeSlug(itemCode),

    name: item.item_name || itemCode,
    price,
    mrp,
    images: buildImageUrl(item.image),
    emoji: "💌",
    category: normalizeCategory(item.item_group),
    badge: undefined,
    // Sanitize HTML coming from ERPNext to prevent stored XSS when
    // rendered with `dangerouslySetInnerHTML` in Server Components.
    description: DOMPurify.sanitize(String(item.description || "")),
    onSale: false,
    isPremium: false,
  };
}

/** Fetch a full Item document (includes all child tables, in row order). */
async function fetchErpItemDoc(
  itemName: string,
): Promise<Record<string, unknown> | null> {
  try {
    const json = await erpFetch<ErpNextSingleResponse<Record<string, unknown>>>(
      `/api/resource/Item/${encodeURIComponent(itemName)}`,
    );
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Pull ordered image URLs out of the Item Image child table on a doc. */
function extractGalleryImages(doc: Record<string, unknown> | null): string[] {
  if (!doc) return [];

  const urls: string[] = [];

  const looksLikeImage = (v: unknown) =>
    typeof v === "string" &&
    (/\.(jpe?g|png|webp|gif)$/i.test(v) ||
      v.startsWith("/files/") ||
      v.startsWith("/private/files/") ||
      v.startsWith("http"));

  const push = (v: unknown) => {
    if (!looksLikeImage(v)) return;
    const url = buildImageUrl(v as string)[0];
    if (url && !urls.includes(url)) urls.push(url);
  };

  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
      return Number(v);
    return null;
  };

  // Resolve a row's sort key: configured field → a field named like "order" → idx.
  const rowOrder = (row: Record<string, unknown>, fallback: number): number => {
    if (ERPNEXT_IMAGE_ORDER_FIELD) {
      const n = toNum(row[ERPNEXT_IMAGE_ORDER_FIELD]);
      if (n !== null) return n;
    }
    for (const key of Object.keys(row)) {
      if (/^(custom_)?(order|sort_order|sequence|position)$/i.test(key)) {
        const n = toNum(row[key]);
        if (n !== null) return n;
      }
    }
    const idx = toNum(row.idx);
    return idx !== null ? idx : fallback;
  };

  // Candidate child tables: the configured one, else any array-of-objects field.
  const tables: Record<string, unknown>[][] = [];
  const preferred = ERPNEXT_IMAGE_TABLE_FIELD
    ? doc[ERPNEXT_IMAGE_TABLE_FIELD]
    : null;

  if (Array.isArray(preferred)) {
    tables.push(preferred as Record<string, unknown>[]);
  } else {
    for (const value of Object.values(doc)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object") {
        tables.push(value as Record<string, unknown>[]);
      }
    }
  }

  for (const rows of tables) {
    const before = urls.length;

    const ordered = rows
      .map((row, i) => ({ row, i, order: rowOrder(row, i) }))
      .sort((a, b) => a.order - b.order || a.i - b.i);

    for (const { row } of ordered) {
      if (!row || typeof row !== "object") continue;
      const direct = row[ERPNEXT_IMAGE_ROW_FIELD];
      if (looksLikeImage(direct)) {
        push(direct);
        continue;
      }
      for (const v of Object.values(row)) {
        if (looksLikeImage(v)) {
          push(v);
          break;
        }
      }
    }

    if (urls.length > before) break; // first table that yielded images wins
  }

  return urls;
}

/** Replace each product's images with its full ordered gallery, if present. */
async function enrichGalleries(products: ErpProduct[]): Promise<ErpProduct[]> {
  const CONCURRENCY = 8;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (p) => {
        const gallery = extractGalleryImages(await fetchErpItemDoc(p.erpName));
        if (gallery.length > 0) p.images = gallery;
      }),
    );
  }

  return products;
}

/** Build the base product list (no gallery enrichment). */
async function buildErpProductList(): Promise<ErpProduct[]> {
  requireErpConfig();

  const itemResponse = await erpFetch<ErpNextListResponse<ErpItem>>(
    "/api/resource/Item",
    {
      fields: JSON.stringify([
        "name",
        "item_code",
        "item_name",
        "item_group",
        "description",
        "image",
        "disabled",
        ERPNEXT_WEBSITE_FIELD,
        "standard_rate",
        "valuation_rate",
      ]),
      filters: JSON.stringify([
        ["Item", "disabled", "=", 0],
        ["Item", ERPNEXT_WEBSITE_FIELD, "=", 1],
      ]),
      limit_page_length: "200",
      order_by: "modified desc",
    },
  );

  const visibleItems = itemResponse.data.filter(
    (item) => item.disabled !== 1 && Number(item[ERPNEXT_WEBSITE_FIELD]) === 1,
  );

  const itemCodes = visibleItems
    .map((item) => item.item_code || item.name)
    .filter(Boolean);
  const priceMap = await fetchItemPrices(itemCodes as string[]);

  return visibleItems.map((item) => mapErpItemToProduct(item, priceMap));
}

export async function fetchErpProducts(): Promise<ErpProduct[]> {
  const products = await buildErpProductList();
  return enrichGalleries(products);
}

export async function fetchErpProductBySlug(
  slug: string,
): Promise<ErpProduct | null> {
  const products = await buildErpProductList();
  const product = products.find((p) => p.slug === slug) ?? null;
  if (!product) return null;

  // Enrich only this product with its ordered gallery (one extra request).
  const gallery = extractGalleryImages(await fetchErpItemDoc(product.erpName));
  if (gallery.length > 0) product.images = gallery;

  return product;
}

export async function fetchErpProductsByCategory(
  category: ProductCategory,
): Promise<ErpProduct[]> {
  const products = await fetchErpProducts();

  return products.filter((product) => product.category === category);
}

/**
 * Products whose ERPNext "Subject" field matches `subject` (case-insensitive)
 * AND that have "Show on Website" enabled. Used by the Wedding Card sub-pages
 * (Hindu / Muslim / Christian).
 */
export async function fetchErpProductsBySubject(
  subject: string,
): Promise<ErpProduct[]> {
  requireErpConfig();

  const target = subject.trim();

  const itemResponse = await erpFetch<ErpNextListResponse<ErpItem>>(
    "/api/resource/Item",
    {
      fields: JSON.stringify([
        "name",
        "item_code",
        "item_name",
        "item_group",
        "description",
        "image",
        "disabled",
        ERPNEXT_WEBSITE_FIELD,
        ERPNEXT_SUBJECT_FIELD,
        "standard_rate",
        "valuation_rate",
      ]),
      filters: JSON.stringify([
        ["Item", "disabled", "=", 0],
        ["Item", ERPNEXT_WEBSITE_FIELD, "=", 1],
        ["Item", ERPNEXT_SUBJECT_FIELD, "=", target],
      ]),
      limit_page_length: "200",
      order_by: "modified desc",
    },
  );

  // Defensive re-filter in JS: guards the flags and matches the subject
  // case-insensitively (ERPNext "=" can be case-sensitive depending on the
  // database collation).
  const visibleItems = itemResponse.data.filter(
    (item) =>
      item.disabled !== 1 &&
      Number(item[ERPNEXT_WEBSITE_FIELD]) === 1 &&
      String(item[ERPNEXT_SUBJECT_FIELD] ?? "")
        .trim()
        .toLowerCase() === target.toLowerCase(),
  );

  const itemCodes = visibleItems
    .map((item) => item.item_code || item.name)
    .filter(Boolean);
  const priceMap = await fetchItemPrices(itemCodes as string[]);

  const products = visibleItems.map((item) =>
    mapErpItemToProduct(item, priceMap),
  );

  return enrichGalleries(products);
}

export async function createErpSalesOrder(payload: {
  customer: string;
  items: { item_code: string; qty: number }[];
}): Promise<{ orderId: string }> {
  requireErpConfig();

  const res = await fetch(buildErpUrl("/api/resource/Sales Order"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `ERPNext Sales Order failed: ${res.status} ${res.statusText}. ${errorText}`,
    );
  }

  const json = (await res.json()) as ErpNextSingleResponse<{ name: string }>;

  return { orderId: json.data.name };
}

export async function createErpLead(payload: {
  lead_name: string;
  email_id: string;
  mobile_no: string;
  notes?: string;
}): Promise<{ leadId: string }> {
  requireErpConfig();

  const res = await fetch(buildErpUrl("/api/resource/Lead"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();

    throw new Error(
      `ERPNext Lead failed: ${res.status} ${res.statusText}. ${errorText}`,
    );
  }

  const json = (await res.json()) as ErpNextSingleResponse<{ name: string }>;

  return { leadId: json.data.name };
}