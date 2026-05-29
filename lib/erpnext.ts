import type { Product, ProductCategory } from "@/types";

const ERPNEXT_URL = process.env.ERPNEXT_URL ?? "";
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY ?? "";
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET ?? "";
const ERPNEXT_PRICE_LIST = process.env.ERPNEXT_PRICE_LIST ?? "Standard Selling";
// Fieldname (NOT the form label) of the "Show on Website" checkbox on Item.
// The label is "Show on Website" but ERPNext v14+ stores custom fields with a
// `custom_` prefix. Confirm the exact name via Customize Form → Item, or by
// opening /api/resource/Item/<ITEM_CODE> and finding the key set to 1.
// Override without editing code by setting ERPNEXT_WEBSITE_FIELD in .env.local.
const ERPNEXT_WEBSITE_FIELD =
  process.env.ERPNEXT_WEBSITE_FIELD ?? "custom_show_on_website";
// How long (seconds) to cache ERPNext responses. Set to 0 in .env.local for
// always-fresh data (every request hits ERPNext) — useful while testing
// "Show on Website" toggles. A small value like 60 is a good production default.
const ERPNEXT_REVALIDATE = Number(
  process.env.ERPNEXT_REVALIDATE_SECONDS ?? "60",
);

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

type ErpFile = {
  name: string;
  file_name?: string;
  file_url?: string;
  attached_to_doctype?: string;
  attached_to_name?: string;
  is_private?: 0 | 1;
};

export type ErpProduct = Product & {
  itemCode: string;
  itemGroup: string;
  erpName: string;
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

  if (
    cleanImage.startsWith("http://") ||
    cleanImage.startsWith("https://")
  ) {
    return [encodeURI(cleanImage)];
  }

  if (cleanImage.startsWith("/")) {
    return [encodeURI(`${cleanBaseUrl()}${cleanImage}`)];
  }

  return [encodeURI(`${cleanBaseUrl()}/${cleanImage}`)];
}

function isImageFile(fileUrl?: string) {
  if (!fileUrl) return false;

  const lower = fileUrl.toLowerCase();

  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
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

async function fetchItemImagesFromFiles(items: ErpItem[]) {
  const imageMap = new Map<string, string>();

  const itemNames = items.map((item) => item.name).filter(Boolean);

  if (itemNames.length === 0) return imageMap;

  // STEP 1: Try File records properly attached to Item
  const chunks = chunkArray(itemNames, 25);

  for (const chunk of chunks) {
    const json = await erpFetch<ErpNextListResponse<ErpFile>>(
      "/api/resource/File",
      {
        fields: JSON.stringify([
          "name",
          "file_name",
          "file_url",
          "attached_to_doctype",
          "attached_to_name",
          "is_private",
        ]),
        filters: JSON.stringify([
          ["File", "attached_to_doctype", "=", "Item"],
          ["File", "attached_to_name", "in", chunk],
          ["File", "is_private", "=", 0],
        ]),
        limit_page_length: "200",
        order_by: "creation desc",
      },
    );

    for (const file of json.data) {
      if (!file.attached_to_name) continue;
      if (!isImageFile(file.file_url)) continue;

      if (!imageMap.has(file.attached_to_name)) {
        const imageUrl = buildImageUrl(file.file_url)[0];

        if (imageUrl) {
          imageMap.set(file.attached_to_name, imageUrl);
        }
      }
    }
  }

  // STEP 2: Fallback by file name / file_url match.
  // Example: Item name 535 -> /files/535.jpg
  const missingItems = items.filter((item) => !imageMap.has(item.name));

  for (const item of missingItems) {
    const possibleBaseNames = Array.from(
      new Set([
        item.name,
        item.item_code,
        item.item_name,
      ].filter(Boolean)),
    );

    const possibleFileUrls: string[] = [];

    for (const baseName of possibleBaseNames) {
      possibleFileUrls.push(`/files/${baseName}.jpg`);
      possibleFileUrls.push(`/files/${baseName}.jpeg`);
      possibleFileUrls.push(`/files/${baseName}.png`);
      possibleFileUrls.push(`/files/${baseName}.webp`);
    }

    for (const fileUrl of possibleFileUrls) {
      try {
        const json = await erpFetch<ErpNextListResponse<ErpFile>>(
          "/api/resource/File",
          {
            fields: JSON.stringify([
              "name",
              "file_name",
              "file_url",
              "attached_to_doctype",
              "attached_to_name",
              "is_private",
            ]),
            filters: JSON.stringify([
              ["File", "file_url", "=", fileUrl],
              ["File", "is_private", "=", 0],
            ]),
            limit_page_length: "1",
          },
        );

        const imageFile = json.data.find((file) => isImageFile(file.file_url));

        if (imageFile?.file_url) {
          imageMap.set(item.name, buildImageUrl(imageFile.file_url)[0]);
          break;
        }
      } catch {
        // Continue checking next possible image name
      }
    }
  }

  return imageMap;
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

    slug: normalizeSlug(itemCode),

    name: item.item_name || itemCode,
    price,
    mrp,
    images: buildImageUrl(item.image),
    emoji: "💌",
    category: normalizeCategory(item.item_group),
    badge: undefined,
    description: item.description || "",
    onSale: false,
    isPremium: false,
  };
}

export async function fetchErpProducts(): Promise<ErpProduct[]> {
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
    (item) =>
      item.disabled !== 1 && Number(item[ERPNEXT_WEBSITE_FIELD]) === 1,
  );
  const itemCodes = visibleItems
    .map((item) => item.item_code || item.name)
    .filter(Boolean);
  const priceMap = await fetchItemPrices(itemCodes as string[]);
  const fileImageMap = await fetchItemImagesFromFiles(visibleItems);

  console.log(
    "ERP FILE IMAGE MAP DEBUG:",
    Array.from(fileImageMap.entries()).slice(0, 20),
  );

  return visibleItems.map((item) => {
    const product = mapErpItemToProduct(item, priceMap);

    if (product.images.length === 0) {
      const fallbackImage = fileImageMap.get(item.name);

      if (fallbackImage) {
        product.images = [fallbackImage];
      }
    }

    return product;
  });
}

export async function fetchErpProductBySlug(
  slug: string,
): Promise<ErpProduct | null> {
  const products = await fetchErpProducts();

  return products.find((product) => product.slug === slug) ?? null;
}

export async function fetchErpProductsByCategory(
  category: ProductCategory,
): Promise<ErpProduct[]> {
  const products = await fetchErpProducts();

  return products.filter((product) => product.category === category);
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