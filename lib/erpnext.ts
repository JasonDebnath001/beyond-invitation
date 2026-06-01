import type { Product, ProductCategory } from "@/types";
import DOMPurify from "isomorphic-dompurify";

function cleanEnv(value?: string) {
  return (value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

const ERPNEXT_URL = cleanEnv(process.env.ERPNEXT_URL);
const ERPNEXT_API_KEY = cleanEnv(process.env.ERPNEXT_API_KEY);
const ERPNEXT_API_SECRET = cleanEnv(process.env.ERPNEXT_API_SECRET);
const ERPNEXT_PRICE_LIST =
  cleanEnv(process.env.ERPNEXT_PRICE_LIST) || "Standard Selling";

// Fieldname (NOT the form label) of the "Show on Website" checkbox on Item.
// Override with ERPNEXT_WEBSITE_FIELD in .env.local if yours differs.
const ERPNEXT_WEBSITE_FIELD =
  process.env.ERPNEXT_WEBSITE_FIELD ?? "custom_show_on_website";

// Fieldname of the "Subject" field on Item — used to split Wedding Cards into
// Hindu / Muslim / Christian. Override with ERPNEXT_SUBJECT_FIELD if needed.
const ERPNEXT_SUBJECT_FIELD =
  process.env.ERPNEXT_SUBJECT_FIELD ?? "custom_subject";

// Product detail custom fields from ERPNext Item.
// These are fieldnames, not labels. Override in .env.local if your fieldnames differ.
const ERPNEXT_CUSTOMISATION_FIELD =
  process.env.ERPNEXT_CUSTOMISATION_FIELD ?? "custom_customisation";
const ERPNEXT_MATERIAL_FIELD =
  process.env.ERPNEXT_MATERIAL_FIELD ?? "custom_material";
const ERPNEXT_INCLUDES_FIELD =
  process.env.ERPNEXT_INCLUDES_FIELD ?? "custom_includes";

// Caching for ERPNext responses (seconds). Set to 0 in .env.local for
// always-fresh data while testing; 60 is a good production default.
const ERPNEXT_REVALIDATE = Number(
  process.env.ERPNEXT_REVALIDATE_SECONDS ?? "60",
);

// --- Multi-image gallery: Item Image child table on Item -------------------

const ERPNEXT_IMAGE_TABLE_FIELD =
  process.env.ERPNEXT_IMAGE_TABLE_FIELD ?? "";
const ERPNEXT_IMAGE_ROW_FIELD =
  process.env.ERPNEXT_IMAGE_ROW_FIELD ?? "image";
const ERPNEXT_IMAGE_ORDER_FIELD =
  process.env.ERPNEXT_IMAGE_ORDER_FIELD ?? "";

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

  /**
   * Value of the ERPNext "Subject" field, e.g. Hindu / Muslim / Christian.
   */
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
    Accept: "application/json",
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

function cleanTextValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  return DOMPurify.sanitize(text);
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
  const priceMap = new Map<string, number>();

  if (itemCodes.length === 0) return priceMap;

  // Small chunks prevent nginx 414 Request-URI Too Large error.
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
    subject: cleanTextValue(item[ERPNEXT_SUBJECT_FIELD]),

    slug: normalizeSlug(itemCode),
    name: item.item_name || itemCode,
    price,
    mrp,
    images: buildImageUrl(item.image),
    emoji: "",
    category: normalizeCategory(item.item_group),
    badge: undefined,

    // Sanitize HTML coming from ERPNext to prevent stored XSS when rendered
    // with dangerouslySetInnerHTML in Server Components.
    description: DOMPurify.sanitize(String(item.description || "")),

    // Product detail fields from ERPNext custom fields.
    customisation: cleanTextValue(item[ERPNEXT_CUSTOMISATION_FIELD]),
    material: cleanTextValue(item[ERPNEXT_MATERIAL_FIELD]),
    includes: cleanTextValue(item[ERPNEXT_INCLUDES_FIELD]),

    onSale: false,
    isPremium: false,
  };
}

/**
 * Fetch a full Item document.
 * This includes child tables and full gallery rows.
 */
async function fetchErpItemDoc(
  itemName: string,
): Promise<Record<string, unknown> | null> {
  try {
    const json = await erpFetch<
      ErpNextSingleResponse<Record<string, unknown>>
    >(`/api/resource/Item/${encodeURIComponent(itemName)}`);

    return json.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Pull ordered image URLs out of the Item Image child table on a doc.
 */
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

    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  };

  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;

    if (
      typeof v === "string" &&
      v.trim() !== "" &&
      Number.isFinite(Number(v))
    ) {
      return Number(v);
    }

    return null;
  };

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

  const tables: Record<string, unknown>[][] = [];

  const preferred = ERPNEXT_IMAGE_TABLE_FIELD
    ? doc[ERPNEXT_IMAGE_TABLE_FIELD]
    : null;

  if (Array.isArray(preferred)) {
    tables.push(preferred as Record<string, unknown>[]);
  } else {
    for (const value of Object.values(doc)) {
      if (
        Array.isArray(value) &&
        value.length &&
        typeof value[0] === "object"
      ) {
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

    // First table that yielded images wins.
    if (urls.length > before) break;
  }

  return urls;
}

/**
 * Replace each product's images with its full ordered gallery, if present.
 */
async function enrichGalleries(products: ErpProduct[]): Promise<ErpProduct[]> {
  const CONCURRENCY = 8;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (p) => {
        const gallery = extractGalleryImages(await fetchErpItemDoc(p.erpName));

        if (gallery.length > 0) {
          p.images = gallery;
        }
      }),
    );
  }

  return products;
}

/**
 * Build the base product list without gallery enrichment.
 */
export async function buildErpProductList(): Promise<ErpProduct[]> {
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
        ERPNEXT_SUBJECT_FIELD,
        ERPNEXT_CUSTOMISATION_FIELD,
        ERPNEXT_MATERIAL_FIELD,
        ERPNEXT_INCLUDES_FIELD,
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

  const gallery = extractGalleryImages(await fetchErpItemDoc(product.erpName));

  if (gallery.length > 0) {
    product.images = gallery;
  }

  return product;
}

export async function fetchErpProductsByCategory(
  category: ProductCategory,
): Promise<ErpProduct[]> {
  const products = await fetchErpProducts();
  return products.filter((product) => product.category === category);
}

/**
 * Products whose ERPNext "Subject" field matches `subject` case-insensitively
 * AND that have "Show on Website" enabled.
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
        ERPNEXT_CUSTOMISATION_FIELD,
        ERPNEXT_MATERIAL_FIELD,
        ERPNEXT_INCLUDES_FIELD,
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

// ===========================================================================
// CHECKOUT / ORDER FULFILMENT - Razorpay integration
// ===========================================================================

const ERPNEXT_DEFAULT_CUSTOMER = process.env.ERPNEXT_DEFAULT_CUSTOMER ?? "";
const ERPNEXT_RZP_ORDER_FIELD =
  process.env.ERPNEXT_RZP_ORDER_FIELD ?? "custom_razorpay_order_id";
const ERPNEXT_RZP_PAYMENT_FIELD =
  process.env.ERPNEXT_RZP_PAYMENT_FIELD ?? "custom_razorpay_payment_id";
const ERPNEXT_PAYMENT_STATUS_FIELD =
  process.env.ERPNEXT_PAYMENT_STATUS_FIELD ?? "custom_payment_status";

// Per-buyer customer creation.
// When enabled and an email is present, the integration finds an existing
// Customer by email or creates one. Otherwise it falls back to default customer.
const ERPNEXT_AUTO_CREATE_CUSTOMER =
  (process.env.ERPNEXT_AUTO_CREATE_CUSTOMER ?? "false") === "true";
const ERPNEXT_CUSTOMER_GROUP =
  process.env.ERPNEXT_CUSTOMER_GROUP ?? "Individual";
const ERPNEXT_TERRITORY =
  process.env.ERPNEXT_TERRITORY ?? "All Territories";
const ERPNEXT_CUSTOMER_EMAIL_FIELD =
  process.env.ERPNEXT_CUSTOMER_EMAIL_FIELD ?? "custom_email";

// Optional full accounting: a submitted Payment Entry receiving the amount
// against the Sales Order.
const ERPNEXT_CREATE_PAYMENT_ENTRY =
  (process.env.ERPNEXT_CREATE_PAYMENT_ENTRY ?? "false") === "true";
const ERPNEXT_COMPANY = process.env.ERPNEXT_COMPANY ?? "";
const ERPNEXT_PAID_TO_ACCOUNT = process.env.ERPNEXT_PAID_TO_ACCOUNT ?? "";
const ERPNEXT_MODE_OF_PAYMENT =
  process.env.ERPNEXT_MODE_OF_PAYMENT ?? "Wire Transfer";

export interface ErpOrderLine {
  item_code: string;
  qty: number;
  rate: number;
}

export interface BuyerInfo {
  name?: string;
  email?: string;
  phone?: string;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;

  notes?: string;
}

interface ResolvedBuyer {
  customer: string;
  addressName: string | null;
  contactName: string | null;
  addressDisplay: string;
}

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(fullName: string) {
  const clean = fullName.trim();

  if (!clean) {
    return {
      firstName: "Customer",
      lastName: "",
    };
  }

  const parts = clean.split(/\s+/);
  const firstName = parts.shift() || clean;
  const lastName = parts.join(" ");

  return {
    firstName,
    lastName,
  };
}

function buildAddressDisplay(buyer?: BuyerInfo) {
  const parts = [
    buyer?.addressLine1,
    buyer?.addressLine2,
    buyer?.city,
    buyer?.state,
    buyer?.pincode,
    buyer?.country,
  ]
    .map((v) => safeTrim(v))
    .filter(Boolean);

  return parts.join(", ");
}

// --- low-level write/read helpers: no caching for transactional calls --------

async function erpWrite<T>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path), {
    method,
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();

    throw new Error(`ERPNext ${method} ${path} failed: ${res.status}. ${t}`);
  }

  return res.json() as Promise<T>;
}

async function erpGetFresh<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path, params), {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text();

    throw new Error(`ERPNext GET ${path} failed: ${res.status}. ${t}`);
  }

  return res.json() as Promise<T>;
}

async function findExistingCustomerByEmail(email: string) {
  const existing = await erpGetFresh<
    ErpNextListResponse<{ name: string }>
  >("/api/resource/Customer", {
    filters: JSON.stringify([
      ["Customer", ERPNEXT_CUSTOMER_EMAIL_FIELD, "=", email],
    ]),
    fields: JSON.stringify(["name"]),
    limit_page_length: "1",
  });

  return existing.data?.[0]?.name ?? null;
}

async function createCustomerForBuyer(buyer: BuyerInfo) {
  const name = safeTrim(buyer.name);
  const email = safeTrim(buyer.email).toLowerCase();
  const phone = safeTrim(buyer.phone);

  const payload: Record<string, unknown> = {
    customer_name: name || email || phone || "Website Customer",
    customer_type: "Individual",
    customer_group: ERPNEXT_CUSTOMER_GROUP,
    territory: ERPNEXT_TERRITORY,
  };

  if (email) {
    payload[ERPNEXT_CUSTOMER_EMAIL_FIELD] = email;
    payload.email_id = email;
  }

  if (phone) {
    payload.mobile_no = phone;
  }

  const created = await erpWrite<ErpNextSingleResponse<{ name: string }>>(
    "POST",
    "/api/resource/Customer",
    payload,
  );

  return created.data.name;
}

async function createAddressForCustomer(customer: string, buyer?: BuyerInfo) {
  const addressLine1 = safeTrim(buyer?.addressLine1);
  const city = safeTrim(buyer?.city);
  const country = safeTrim(buyer?.country) || "India";

  if (!addressLine1 || !city || !country) return null;

  const payload = {
    address_title: safeTrim(buyer?.name) || customer,
    address_type: "Billing",
    address_line1: addressLine1,
    address_line2: safeTrim(buyer?.addressLine2),
    city,
    state: safeTrim(buyer?.state),
    pincode: safeTrim(buyer?.pincode),
    country,
    email_id: safeTrim(buyer?.email),
    phone: safeTrim(buyer?.phone),
    is_primary_address: 1,
    is_shipping_address: 1,
    links: [
      {
        link_doctype: "Customer",
        link_name: customer,
      },
    ],
  };

  const created = await erpWrite<ErpNextSingleResponse<{ name: string }>>(
    "POST",
    "/api/resource/Address",
    payload,
  );

  return created.data.name;
}

async function createContactForCustomer(customer: string, buyer?: BuyerInfo) {
  const name = safeTrim(buyer?.name);
  const email = safeTrim(buyer?.email);
  const phone = safeTrim(buyer?.phone);

  if (!name && !email && !phone) return null;

  const { firstName, lastName } = splitName(name);

  const payload = {
    first_name: firstName,
    last_name: lastName,
    is_primary_contact: 1,
    is_billing_contact: 1,
    email_ids: email
      ? [
          {
            email_id: email,
            is_primary: 1,
          },
        ]
      : [],
    phone_nos: phone
      ? [
          {
            phone,
            is_primary_mobile_no: 1,
          },
        ]
      : [],
    links: [
      {
        link_doctype: "Customer",
        link_name: customer,
      },
    ],
  };

  const created = await erpWrite<ErpNextSingleResponse<{ name: string }>>(
    "POST",
    "/api/resource/Contact",
    payload,
  );

  return created.data.name;
}

/**
 * Resolve/create ERP Customer and save Address + Contact.
 *
 * Important:
 * - Set ERPNEXT_AUTO_CREATE_CUSTOMER=true for real customer-wise orders.
 * - If false, it falls back to ERPNEXT_DEFAULT_CUSTOMER, but still attaches
 *   Address/Contact to that fallback customer.
 */
export async function resolveCustomerWithDetails(
  buyer?: BuyerInfo,
): Promise<ResolvedBuyer> {
  const fallback = ERPNEXT_DEFAULT_CUSTOMER;
  const email = safeTrim(buyer?.email).toLowerCase();

  let customer = fallback;

  if (ERPNEXT_AUTO_CREATE_CUSTOMER && email) {
    try {
      customer =
        (await findExistingCustomerByEmail(email)) ||
        (await createCustomerForBuyer(buyer || {}));
    } catch (e) {
      console.error("Customer resolve/create failed:", e);

      if (!fallback) {
        throw e;
      }

      customer = fallback;
    }
  }

  if (!customer) {
    throw new Error(
      "No ERP customer: set ERPNEXT_DEFAULT_CUSTOMER or enable ERPNEXT_AUTO_CREATE_CUSTOMER.",
    );
  }

  let addressName: string | null = null;
  let contactName: string | null = null;

  try {
    addressName = await createAddressForCustomer(customer, buyer);
  } catch (e) {
    console.error("ERPNext Address create failed:", e);
  }

  try {
    contactName = await createContactForCustomer(customer, buyer);
  } catch (e) {
    console.error("ERPNext Contact create failed:", e);
  }

  return {
    customer,
    addressName,
    contactName,
    addressDisplay: buildAddressDisplay(buyer),
  };
}

/**
 * Backward-compatible helper.
 */
export async function resolveCustomer(buyer?: BuyerInfo): Promise<string> {
  const resolved = await resolveCustomerWithDetails(buyer);
  return resolved.customer;
}

/**
 * Find a Sales Order by its stored Razorpay order id.
 * Returns null if none exists.
 */
export async function findSalesOrderByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<{ name: string; docstatus: number } | null> {
  const json = await erpGetFresh<
    ErpNextListResponse<{ name: string; docstatus: number }>
  >("/api/resource/Sales Order", {
    filters: JSON.stringify([
      ["Sales Order", ERPNEXT_RZP_ORDER_FIELD, "=", razorpayOrderId],
    ]),
    fields: JSON.stringify(["name", "docstatus"]),
    limit_page_length: "1",
  });

  return json.data?.[0] ?? null;
}

/**
 * Create a DRAFT Sales Order tagged with the Razorpay order id.
 */
export async function createDraftSalesOrder(args: {
  razorpayOrderId: string;
  items: ErpOrderLine[];
  buyer?: BuyerInfo;
}): Promise<{ name: string }> {
  const resolved = await resolveCustomerWithDetails(args.buyer);

  const d = new Date();
  d.setDate(d.getDate() + 7);
  const delivery_date = d.toISOString().slice(0, 10);

  const buyerNotes = [
    safeTrim(args.buyer?.notes)
      ? `Customer Notes: ${safeTrim(args.buyer?.notes)}`
      : "",
    resolved.addressDisplay
      ? `Customer Address: ${resolved.addressDisplay}`
      : "",
    safeTrim(args.buyer?.phone)
      ? `Customer Mobile: ${safeTrim(args.buyer?.phone)}`
      : "",
    safeTrim(args.buyer?.email)
      ? `Customer Email: ${safeTrim(args.buyer?.email)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const payload: Record<string, unknown> = {
    customer: resolved.customer,
    customer_name: safeTrim(args.buyer?.name) || undefined,
    order_type: "Sales",
    delivery_date,

    // Prices are tax-inclusive on the storefront — no auto tax template, so
    // grand_total matches the amount charged. Remove if you apply taxes.
    taxes_and_charges: "",

    customer_address: resolved.addressName || undefined,
    address_display: resolved.addressDisplay || undefined,
    contact_person: resolved.contactName || undefined,
    contact_email: safeTrim(args.buyer?.email) || undefined,
    contact_mobile: safeTrim(args.buyer?.phone) || undefined,

    notes: buyerNotes || undefined,

    items: args.items.map((l) => ({
      item_code: l.item_code,
      qty: l.qty,
      rate: l.rate,
      delivery_date,
    })),

    [ERPNEXT_RZP_ORDER_FIELD]: args.razorpayOrderId,
    [ERPNEXT_PAYMENT_STATUS_FIELD]: "Pending",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === "") {
      delete payload[key];
    }
  });

  const json = await erpWrite<ErpNextSingleResponse<{ name: string }>>(
    "POST",
    "/api/resource/Sales Order",
    payload,
  );

  return { name: json.data.name };
}

/**
 * Mark a Sales Order paid and submit it.
 * Idempotent — safe to call from both inline verify handler and webhook.
 */
export async function fulfillSalesOrder(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<{ name: string; alreadyFulfilled: boolean }> {
  const existing = await findSalesOrderByRazorpayOrderId(args.razorpayOrderId);

  if (!existing) {
    throw new Error(
      `No draft Sales Order for Razorpay order ${args.razorpayOrderId}.`,
    );
  }

  if (existing.docstatus === 1) {
    return {
      name: existing.name,
      alreadyFulfilled: true,
    };
  }

  const soPath = `/api/resource/Sales Order/${encodeURIComponent(
    existing.name,
  )}`;

  // 1) Stamp payment fields while still a draft.
  await erpWrite("PUT", soPath, {
    [ERPNEXT_RZP_PAYMENT_FIELD]: args.razorpayPaymentId,
    [ERPNEXT_PAYMENT_STATUS_FIELD]: "Paid",
  });

  // 2) Submit Sales Order: docstatus 0 -> 1.
  try {
    const submitted = await erpWrite<
      ErpNextSingleResponse<{ docstatus: number }>
    >("PUT", soPath, {
      docstatus: 1,
    });

    if (submitted.data?.docstatus !== 1) {
      throw new Error("Submit did not set docstatus to 1.");
    }
  } catch (e) {
    // Race between webhook and inline handler: if now submitted, succeed.
    const recheck = await findSalesOrderByRazorpayOrderId(
      args.razorpayOrderId,
    );

    if (recheck?.docstatus === 1) {
      return {
        name: existing.name,
        alreadyFulfilled: true,
      };
    }

    throw e;
  }

  // 3) Optional full accounting — best-effort, never fails the order.
  if (ERPNEXT_CREATE_PAYMENT_ENTRY) {
    try {
      await createPaymentEntryForSalesOrder({
        salesOrderName: existing.name,
        razorpayPaymentId: args.razorpayPaymentId,
      });
    } catch (e) {
      console.error("Payment Entry failed; order still marked paid:", e);
    }
  }

  return {
    name: existing.name,
    alreadyFulfilled: false,
  };
}

/**
 * Optional: a submitted Payment Entry receiving the amount against Sales Order.
 */
export async function createPaymentEntryForSalesOrder(args: {
  salesOrderName: string;
  razorpayPaymentId: string;
}): Promise<{ name: string } | null> {
  if (!ERPNEXT_COMPANY || !ERPNEXT_PAID_TO_ACCOUNT) {
    console.warn(
      "Payment Entry skipped: set ERPNEXT_COMPANY and ERPNEXT_PAID_TO_ACCOUNT.",
    );

    return null;
  }

  const so = await erpGetFresh<
    ErpNextSingleResponse<{
      name: string;
      customer: string;
      grand_total: number;
    }>
  >(`/api/resource/Sales Order/${encodeURIComponent(args.salesOrderName)}`);

  const amount = Number(so.data.grand_total || 0);
  const today = new Date().toISOString().slice(0, 10);

  const pe = await erpWrite<ErpNextSingleResponse<{ name: string }>>(
    "POST",
    "/api/resource/Payment Entry",
    {
      payment_type: "Receive",
      party_type: "Customer",
      party: so.data.customer,
      company: ERPNEXT_COMPANY,
      paid_amount: amount,
      received_amount: amount,
      paid_to: ERPNEXT_PAID_TO_ACCOUNT,
      mode_of_payment: ERPNEXT_MODE_OF_PAYMENT,
      reference_no: args.razorpayPaymentId,
      reference_date: today,
      references: [
        {
          reference_doctype: "Sales Order",
          reference_name: args.salesOrderName,
          allocated_amount: amount,
        },
      ],
    },
  );

  await erpWrite(
    "PUT",
    `/api/resource/Payment Entry/${encodeURIComponent(pe.data.name)}`,
    {
      docstatus: 1,
    },
  );

  return { name: pe.data.name };
}