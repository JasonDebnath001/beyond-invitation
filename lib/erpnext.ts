import type { Product, ProductCategory } from "@/types";
import DOMPurify from "isomorphic-dompurify";

function cleanEnv(value?: string) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

const ERPNEXT_URL = cleanEnv(process.env.ERPNEXT_URL);
const ERPNEXT_API_KEY = cleanEnv(process.env.ERPNEXT_API_KEY);
const ERPNEXT_API_SECRET = cleanEnv(process.env.ERPNEXT_API_SECRET);

const ERPNEXT_PRICE_LIST =
  cleanEnv(process.env.ERPNEXT_PRICE_LIST) || "Standard Selling";

const ERPNEXT_PRODUCT_PRICE_FIELD =
  cleanEnv(process.env.ERPNEXT_PRODUCT_PRICE_FIELD) || "custom_price";

// Fieldname (NOT the form label) of the "Show on Website" checkbox on Item.
const ERPNEXT_WEBSITE_FIELD =
  process.env.ERPNEXT_WEBSITE_FIELD ?? "custom_show_on_website";

// Fieldname of the "Subject" field on Item.
const ERPNEXT_SUBJECT_FIELD =
  process.env.ERPNEXT_SUBJECT_FIELD ?? "custom_subject";

// Product detail custom fields from ERPNext Item.
const ERPNEXT_CUSTOMISATION_FIELD =
  process.env.ERPNEXT_CUSTOMISATION_FIELD ?? "custom_customisation";

const ERPNEXT_MATERIAL_FIELD =
  process.env.ERPNEXT_MATERIAL_FIELD ?? "custom_material";

const ERPNEXT_INCLUDES_FIELD =
  process.env.ERPNEXT_INCLUDES_FIELD ?? "custom_includes";

// ---------------------------------------------------------------------------
// ERPNext Website Catalogue fields
// ---------------------------------------------------------------------------
//
// These must contain the ERPNext fieldnames, not the visible form labels.
//
// The code also automatically checks common fieldnames such as:
// - custom_website_title
// - website_title
// - custom_website_short_description
// - website_short_description
//
// Environment variables are optional but recommended when your ERPNext
// fieldnames are different.

const ERPNEXT_WEBSITE_TITLE_FIELD = cleanEnv(
  process.env.ERPNEXT_WEBSITE_TITLE_FIELD,
);

const ERPNEXT_WEBSITE_SHORT_DESCRIPTION_FIELD = cleanEnv(
  process.env.ERPNEXT_WEBSITE_SHORT_DESCRIPTION_FIELD,
);

// Caching for ERPNext responses.
const ERPNEXT_REVALIDATE = Number(
  process.env.ERPNEXT_REVALIDATE_SECONDS ?? "60",
);

// --- Multi-image gallery: Item Image child table on Item -------------------
const ERPNEXT_IMAGE_TABLE_FIELD = process.env.ERPNEXT_IMAGE_TABLE_FIELD ?? "";

const ERPNEXT_IMAGE_ROW_FIELD = process.env.ERPNEXT_IMAGE_ROW_FIELD ?? "image";

const ERPNEXT_IMAGE_ORDER_FIELD = process.env.ERPNEXT_IMAGE_ORDER_FIELD ?? "";

// --- Multi-video gallery: direct Item field or child table on Item ----------
// IMPORTANT:
// Do NOT put this field in the Item get_list fields array.
// Some Frappe/ERPNext setups reject custom fields in list queries.
const ERPNEXT_VIDEO_FIELD =
  process.env.ERPNEXT_VIDEO_FIELD ?? "custom_video_link";

const ERPNEXT_VIDEO_TABLE_FIELD = process.env.ERPNEXT_VIDEO_TABLE_FIELD ?? "";

const ERPNEXT_VIDEO_ROW_FIELD = process.env.ERPNEXT_VIDEO_ROW_FIELD ?? "video";

const ERPNEXT_VIDEO_ORDER_FIELD = process.env.ERPNEXT_VIDEO_ORDER_FIELD ?? "";

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

type ErpFileAttachment = {
  name: string;
  file_name?: string;
  file_url?: string;
  attached_to_doctype?: string;
  attached_to_name?: string;
  is_folder?: 0 | 1;
  is_private?: 0 | 1 | boolean | string;
  creation?: string;
  modified?: string;
};

type ErpAttachmentMedia = {
  images: string[];
  videos: string[];
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

function isTruthyErpFlag(value: unknown) {
  return value === 1 || value === true || value === "1" || value === "true";
}

function isPrivateFileUrl(value: unknown) {
  if (typeof value !== "string") return false;

  const clean = value.trim().toLowerCase();

  return (
    clean.startsWith("/private/files/") || clean.includes("/private/files/")
  );
}

function isPrivateFileRecord(row: Record<string, unknown>) {
  return (
    isTruthyErpFlag(row.is_private) ||
    isTruthyErpFlag(row.isPrivate) ||
    isPrivateFileUrl(row.file_url) ||
    isPrivateFileUrl(row.file) ||
    isPrivateFileUrl(row.image) ||
    isPrivateFileUrl(row.image_url) ||
    isPrivateFileUrl(row.attachment) ||
    isPrivateFileUrl(row.attach) ||
    isPrivateFileUrl(row.url)
  );
}

function buildImageUrl(image?: string): string[] {
  if (!image) return [];

  const cleanImage = image.trim();
  if (!cleanImage) return [];

  // Never expose ERPNext private files on the public website.
  if (isPrivateFileUrl(cleanImage)) return [];

  if (cleanImage.startsWith("http://") || cleanImage.startsWith("https://")) {
    return [encodeURI(cleanImage)];
  }

  if (cleanImage.startsWith("/")) {
    return [encodeURI(`${cleanBaseUrl()}${cleanImage}`)];
  }

  return [encodeURI(`${cleanBaseUrl()}/${cleanImage}`)];
}

function normalizeVideoUrl(value?: string): string[] {
  if (!value) return [];

  const clean = value.trim();

  if (!clean) return [];

  return clean
    .split(/[\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((url) => {
      return (
        url.startsWith("https://") ||
        url.startsWith("http://") ||
        url.startsWith("/files/") ||
        url.startsWith("/private/files/")
      );
    });
}

function buildVideoUrl(video?: string): string[] {
  const urls = normalizeVideoUrl(video);

  return urls.map((url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return encodeURI(url);
    }

    if (url.startsWith("/")) {
      return encodeURI(`${cleanBaseUrl()}${url}`);
    }

    return encodeURI(url);
  });
}

function isDirectVideoFile(value: string) {
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(value.split("?")[0]);
}

function isVideoPlatformUrl(value: string) {
  return (
    value.includes("youtube.com/watch") ||
    value.includes("youtube.com/embed") ||
    value.includes("youtube.com/shorts/") ||
    value.includes("youtu.be/") ||
    value.includes("vimeo.com/")
  );
}

function looksLikeVideoUrl(value: unknown) {
  if (typeof value !== "string") return false;

  const v = value.trim();

  if (!v) return false;

  /**
   * Important:
   * Do NOT treat every /files/... URL as a video.
   * ERPNext images also live under /files/.
   */
  return isDirectVideoFile(v) || isVideoPlatformUrl(v);
}

function toYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");

        return id ? `https://www.youtube.com/embed/${id}` : url;
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/")[2];

        return id ? `https://www.youtube.com/embed/${id}` : url;
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return url;
      }
    }

    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");

      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    return url;
  } catch {
    return url;
  }
}

function cleanTextValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();

  if (!text) return "";

  return DOMPurify.sanitize(text);
}

function cleanPlainTextValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();

  if (!text) return "";

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFieldName(fieldName: string): string {
  return fieldName
    .toLowerCase()
    .replace(/^custom_/, "")
    .replace(/[^a-z0-9]/g, "");
}

function convertFieldValueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  /*
   * Defensive support in case a translated/custom field is returned
   * as an object rather than a direct string.
   */
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    const possibleKeys = [
      "value",
      "text",
      "content",
      "description",
      "html",
      "en",
      "en-US",
      "en_US",
    ];

    for (const key of possibleKeys) {
      const nestedValue = record[key];

      if (typeof nestedValue === "string" && nestedValue.trim().length > 0) {
        return nestedValue.trim();
      }
    }
  }

  return "";
}

function getFirstNonEmptyField(
  source: Record<string, unknown> | null,
  fieldNames: string[],
): string {
  if (!source) return "";

  for (const fieldName of fieldNames) {
    const cleanedFieldName = fieldName.trim();

    if (!cleanedFieldName) continue;

    const value = convertFieldValueToString(source[cleanedFieldName]);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Find Website Title even when the ERPNext fieldname differs slightly.
 */
function findWebsiteTitle(doc: Record<string, unknown> | null): string {
  if (!doc) return "";

  const directValue = getFirstNonEmptyField(doc, [
    ERPNEXT_WEBSITE_TITLE_FIELD,
    "custom_website_title",
    "website_title",
    "custom_web_title",
    "web_title",
  ]);

  if (directValue) {
    return directValue;
  }

  for (const [fieldName, rawValue] of Object.entries(doc)) {
    const normalized = normalizeFieldName(fieldName);

    const isWebsiteTitle =
      normalized === "websitetitle" ||
      normalized === "webtitle" ||
      (normalized.includes("website") && normalized.includes("title"));

    if (!isWebsiteTitle) continue;

    const value = convertFieldValueToString(rawValue);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Find Website Short Description even when its real fieldname is something
 * like:
 *
 * custom_website_short_description
 * website_short_description
 * custom_website_description
 * custom_web_short_description
 */
function findWebsiteShortDescription(
  doc: Record<string, unknown> | null,
): string {
  if (!doc) return "";

  const directValue = getFirstNonEmptyField(doc, [
    ERPNEXT_WEBSITE_SHORT_DESCRIPTION_FIELD,
    "custom_website_short_description",
    "website_short_description",
    "custom_website_description",
    "website_description",
    "custom_web_short_description",
    "web_short_description",
    "custom_short_description",
    "short_description",
  ]);

  if (directValue) {
    return directValue;
  }

  for (const [fieldName, rawValue] of Object.entries(doc)) {
    const normalized = normalizeFieldName(fieldName);

    const containsDescription = normalized.includes("description");

    const containsWebsiteReference =
      normalized.includes("website") || normalized.startsWith("web");

    const isWebsiteDescription =
      containsDescription && containsWebsiteReference;

    if (!isWebsiteDescription) continue;

    const value = convertFieldValueToString(rawValue);

    if (value) {
      return value;
    }
  }

  return "";
}

async function getWebsiteCatalogueContent(
  doc: Record<string, unknown> | null,
): Promise<{
  title: string;
  description: string;
}> {
  if (!doc) {
    return {
      title: "",
      description: "",
    };
  }

  let title = findWebsiteTitle(doc);
  let description = findWebsiteShortDescription(doc);

  /*
   * G225-17 is a variant of G225.
   *
   * If Website Title or Website Short Description is missing from the
   * variant API response, retrieve it from the template Item.
   */
  const variantOf = convertFieldValueToString(doc.variant_of);

  if ((!title || !description) && variantOf) {
    const templateDoc = await fetchErpItemDoc(variantOf);

    if (templateDoc) {
      if (!title) {
        title = findWebsiteTitle(templateDoc);
      }

      if (!description) {
        description = findWebsiteShortDescription(templateDoc);
      }
    }
  }

  return {
    title,
    description,
  };
}

async function applyWebsiteCatalogueContent(
  product: ErpProduct,
  doc: Record<string, unknown> | null,
): Promise<void> {
  if (!doc) return;

  const websiteContent = await getWebsiteCatalogueContent(doc);

  if (websiteContent.title) {
    const cleanTitle = cleanPlainTextValue(websiteContent.title);

    if (cleanTitle) {
      product.name = cleanTitle;
    }
  }

  if (websiteContent.description) {
    const cleanDescription = DOMPurify.sanitize(websiteContent.description, {
      USE_PROFILES: {
        html: true,
      },
    }).trim();

    if (cleanDescription) {
      product.description = cleanDescription;
    }
  }
}

/**
 * Fallback field detection.
 *
 * ERPNext custom fields normally have a "custom_" prefix. This function
 * allows both of these to work:
 *
 * custom_website_title
 * website_title
 *
 * and:
 *
 * custom_website_short_description
 * website_short_description
 */
function findFieldByNormalizedName(
  source: Record<string, unknown> | null,
  expectedName: string,
): string {
  if (!source) return "";

  const normalizedExpectedName = expectedName
    .toLowerCase()
    .replace(/^custom_/, "")
    .replace(/[^a-z0-9]+/g, "");

  for (const [fieldName, value] of Object.entries(source)) {
    if (value === null || value === undefined) continue;

    const normalizedFieldName = fieldName
      .toLowerCase()
      .replace(/^custom_/, "")
      .replace(/[^a-z0-9]+/g, "");

    if (normalizedFieldName !== normalizedExpectedName) continue;

    const text = String(value).trim();

    if (text) {
      return text;
    }
  }

  return "";
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

function parseProductPrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const cleanedValue = value
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
      .trim();

    if (!cleanedValue) {
      return null;
    }

    const parsedValue = Number(cleanedValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function getCustomProductPrice(item: Record<string, unknown>): number | null {
  const configuredPrice = parseProductPrice(item[ERPNEXT_PRODUCT_PRICE_FIELD]);

  if (configuredPrice !== null) {
    return configuredPrice;
  }

  /*
   * Extra fallbacks in case the ERPNext fieldname is
   * "custom_price" or simply "price".
   */
  const customPrice = parseProductPrice(item.custom_price);

  if (customPrice !== null) {
    return customPrice;
  }

  return parseProductPrice(item.price);
}

function mapErpItemToProduct(
  item: ErpItem,
  priceMap: Map<string, number>,
): ErpProduct {
  const itemCode = item.item_code || item.name;

  const customFieldPrice = getCustomProductPrice(item);

  const oldErpPrice =
    priceMap.get(itemCode) ??
    Number(item.standard_rate || 0) ??
    Number(item.valuation_rate || 0);

  /*
   * Custom Price field is now the primary source.
   * The old ERP price is used only when custom_price is empty.
   */
  const price = customFieldPrice ?? 0;

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

    description: DOMPurify.sanitize(String(item.description || "")),

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
    const json = await erpFetch<ErpNextSingleResponse<Record<string, unknown>>>(
      `/api/resource/Item/${encodeURIComponent(itemName)}`,
    );

    return json.data ?? null;
  } catch {
    return null;
  }
}

function extractGalleryImages(
  doc: Record<string, unknown> | null,
  primaryImage?: string,
): string[] {
  const urls: string[] = [];

  const looksLikeImage = (v: unknown) => {
    if (typeof v !== "string") return false;

    const value = v.trim();
    if (!value) return false;

    // Do not allow private ERPNext files.
    if (isPrivateFileUrl(value)) return false;

    // Do not allow videos to be collected as gallery images.
    if (looksLikeVideoUrl(value)) return false;

    const cleanPath = value.split("?")[0].toLowerCase();

    return (
      /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/i.test(cleanPath) ||
      value.startsWith("/files/") ||
      value.includes("/files/")
    );
  };

  const push = (v: unknown) => {
    if (!looksLikeImage(v)) return;

    const built = buildImageUrl(v as string)[0];

    if (built && !urls.includes(built)) {
      urls.push(built);
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

  const collectRows = (rows: Record<string, unknown>[]) => {
    const ordered = rows
      .map((row, i) => ({
        row,
        i,
        order: rowOrder(row, i),
      }))
      .sort((a, b) => a.order - b.order || a.i - b.i);

    for (const { row } of ordered) {
      if (isPrivateFileRecord(row)) continue;
      if (!row || typeof row !== "object") continue;

      // Preferred configured field, usually "image".
      const direct = row[ERPNEXT_IMAGE_ROW_FIELD];

      if (looksLikeImage(direct)) {
        push(direct);
        continue;
      }

      // Common ERPNext / Frappe attachment fields.
      const commonFields = [
        "image",
        "image_url",
        "file_url",
        "file",
        "attachment",
        "attach",
        "url",
        "thumbnail",
        "website_image",
      ];

      for (const field of commonFields) {
        if (looksLikeImage(row[field])) {
          push(row[field]);
          break;
        }
      }

      // Last fallback: scan all string values in the row.
      for (const v of Object.values(row)) {
        if (looksLikeImage(v)) {
          push(v);
          break;
        }
      }
    }
  };

  // Always include main ERPNext Item image first.
  push(primaryImage);

  if (!doc) return urls;

  // Also include image fields directly present on Item.
  push(doc.image);
  push(doc.website_image);
  push(doc.thumbnail);
  push(doc.image_url);

  const tables: Record<string, unknown>[][] = [];

  // First collect explicitly configured image child table.
  const preferred = ERPNEXT_IMAGE_TABLE_FIELD
    ? doc[ERPNEXT_IMAGE_TABLE_FIELD]
    : null;

  if (
    Array.isArray(preferred) &&
    preferred.length &&
    typeof preferred[0] === "object"
  ) {
    tables.push(preferred as Record<string, unknown>[]);
  }

  // Then collect every other child table / attachment table.
  // Important: do NOT stop after the first table.
  // Some ERPNext products expose images through attachments first,
  // while the actual gallery images are in another child table.
  for (const value of Object.values(doc)) {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      const rows = value as Record<string, unknown>[];

      if (!tables.includes(rows)) {
        tables.push(rows);
      }
    }
  }

  for (const rows of tables) {
    collectRows(rows);
  }

  return urls;
}

async function fetchErpItemAttachments(
  itemName: string,
  itemCode?: string,
): Promise<ErpAttachmentMedia> {
  const names = Array.from(
    new Set([itemName, itemCode].filter(Boolean) as string[]),
  );

  const images: string[] = [];
  const videos: string[] = [];

  const looksLikeImage = (v: unknown) => {
    if (typeof v !== "string") return false;

    const value = v.trim();
    if (!value) return false;

    if (isPrivateFileUrl(value)) return false;
    if (looksLikeVideoUrl(value)) return false;

    const cleanPath = value.split("?")[0].toLowerCase();

    return (
      /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/i.test(cleanPath) ||
      value.startsWith("/files/") ||
      value.includes("/files/")
    );
  };

  const pushImage = (value?: string) => {
    if (!looksLikeImage(value)) return;

    const built = buildImageUrl(value)[0];

    if (built && !images.includes(built)) {
      images.push(built);
    }
  };

  const pushVideo = (value?: string) => {
    if (!looksLikeVideoUrl(value)) return;

    const built = buildVideoUrl(value).map(toYoutubeEmbedUrl);

    for (const url of built) {
      if (url && !videos.includes(url)) {
        videos.push(url);
      }
    }
  };

  for (const name of names) {
    try {
      const json = await erpFetch<ErpNextListResponse<ErpFileAttachment>>(
        "/api/resource/File",
        {
          fields: JSON.stringify([
            "name",
            "file_name",
            "file_url",
            "attached_to_doctype",
            "attached_to_name",
            "is_folder",
            "is_private",
            "creation",
            "modified",
          ]),
          filters: JSON.stringify([
            ["File", "attached_to_doctype", "=", "Item"],
            ["File", "attached_to_name", "=", name],
            ["File", "is_folder", "=", 0],
            ["File", "is_private", "=", 0],
          ]),
          limit_page_length: "100",
          order_by: "creation asc",
        },
      );

      for (const file of json.data || []) {
        if (isPrivateFileRecord(file as Record<string, unknown>)) continue;

        // YouTube links attached as File URL should go into product.videos.
        pushVideo(file.file_url);
        pushVideo(file.file_name);

        // Normal ERPNext uploaded files should remain as product.images.
        pushImage(file.file_url);
      }
    } catch {
      // Some ERPNext users may not have File API permission.
      // In that case, the child table / item image fallback still works.
    }
  }

  return {
    images,
    videos,
  };
}

function mergeImageLists(...lists: string[][]): string[] {
  const merged: string[] = [];

  for (const list of lists) {
    for (const image of list) {
      if (!image) continue;
      if (isPrivateFileUrl(image)) continue;
      if (looksLikeVideoUrl(image)) continue;

      if (!merged.includes(image)) {
        merged.push(image);
      }
    }
  }

  return merged;
}

function mergeVideoLists(...lists: string[][]): string[] {
  const merged: string[] = [];

  for (const list of lists) {
    for (const video of list) {
      if (!video) continue;
      if (isPrivateFileUrl(video)) continue;

      if (!merged.includes(video)) {
        merged.push(video);
      }
    }
  }

  return merged;
}

/**
 * Pull video URLs from:
 * 1. direct Item field, e.g. custom_video_link
 * 2. child table rows, e.g. custom_product_videos -> video
 * 3. any child row value that looks like a video URL
 */
function extractGalleryVideos(doc: Record<string, unknown> | null): string[] {
  if (!doc) return [];

  const urls: string[] = [];

  const push = (v: unknown) => {
    if (!looksLikeVideoUrl(v)) return;

    const built = buildVideoUrl(v as string).map(toYoutubeEmbedUrl);

    for (const url of built) {
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
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
    if (ERPNEXT_VIDEO_ORDER_FIELD) {
      const n = toNum(row[ERPNEXT_VIDEO_ORDER_FIELD]);
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

  // 1. Configured direct field from .env
  push(doc[ERPNEXT_VIDEO_FIELD]);

  // 2. Common direct Item fieldnames
  const directVideoFields = [
    "custom_video_link",
    "custom_video_url",
    "custom_youtube_link",
    "custom_youtube_url",
    "custom_product_video",
    "custom_product_video_link",
    "video",
    "video_url",
    "video_link",
    "youtube",
    "youtube_url",
    "youtube_link",
  ];

  for (const field of directVideoFields) {
    push(doc[field]);
  }

  // 3. Scan all top-level string fields on Item
  for (const value of Object.values(doc)) {
    if (typeof value === "string") {
      push(value);
    }
  }

  // 4. Scan configured child table first, then all other child tables
  const tables: Record<string, unknown>[][] = [];

  const preferred = ERPNEXT_VIDEO_TABLE_FIELD
    ? doc[ERPNEXT_VIDEO_TABLE_FIELD]
    : null;

  if (
    Array.isArray(preferred) &&
    preferred.length &&
    typeof preferred[0] === "object"
  ) {
    tables.push(preferred as Record<string, unknown>[]);
  }

  for (const value of Object.values(doc)) {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      const rows = value as Record<string, unknown>[];

      if (!tables.includes(rows)) {
        tables.push(rows);
      }
    }
  }

  for (const rows of tables) {
    const ordered = rows
      .map((row, i) => ({
        row,
        i,
        order: rowOrder(row, i),
      }))
      .sort((a, b) => a.order - b.order || a.i - b.i);

    for (const { row } of ordered) {
      if (!row || typeof row !== "object") continue;

      const direct = row[ERPNEXT_VIDEO_ROW_FIELD];

      if (looksLikeVideoUrl(direct)) {
        push(direct);
        continue;
      }

      const commonRowFields = [
        "video",
        "video_url",
        "video_link",
        "youtube",
        "youtube_url",
        "youtube_link",
        "url",
        "link",
      ];

      for (const field of commonRowFields) {
        if (looksLikeVideoUrl(row[field])) {
          push(row[field]);
          break;
        }
      }

      for (const value of Object.values(row)) {
        if (looksLikeVideoUrl(value)) {
          push(value);
          break;
        }
      }
    }
  }

  return urls;
}

/**
 * Replace each product's images/videos with its full ordered gallery, if present.
 */
/**
 * Replace each product's images/videos with its full ordered gallery,
 * if present.
 *
 * This function also applies the Website Catalogue title and description
 * from the complete ERPNext Item document.
 */
async function enrichGalleries(products: ErpProduct[]): Promise<ErpProduct[]> {
  const CONCURRENCY = 8;

  for (let index = 0; index < products.length; index += CONCURRENCY) {
    const batch = products.slice(index, index + CONCURRENCY);

    await Promise.all(
      batch.map(async (product) => {
        const doc = await fetchErpItemDoc(product.erpName);

        await applyWebsiteCatalogueContent(product, doc);

        const gallery = extractGalleryImages(doc, product.images?.[0]);

        const attachments = await fetchErpItemAttachments(
          product.erpName,
          product.itemCode,
        );

        const allImages = mergeImageLists(
          product.images || [],
          gallery,
          attachments.images,
        );

        if (allImages.length > 0) {
          product.images = allImages;
        }

        const videos = mergeVideoLists(
          extractGalleryVideos(doc),
          attachments.videos,
        );

        if (videos.length > 0) {
          product.videos = videos;
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
        ERPNEXT_PRODUCT_PRICE_FIELD,
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

  const product = products.find((candidate) => candidate.slug === slug) ?? null;

  if (!product) {
    return null;
  }

  const doc = await fetchErpItemDoc(product.erpName);

  await applyWebsiteCatalogueContent(product, doc);

  const gallery = extractGalleryImages(doc, product.images?.[0]);

  const attachments = await fetchErpItemAttachments(
    product.erpName,
    product.itemCode,
  );

  const allImages = mergeImageLists(
    product.images || [],
    gallery,
    attachments.images,
  );

  if (allImages.length > 0) {
    product.images = allImages;
  }

  const videos = mergeVideoLists(extractGalleryVideos(doc), attachments.videos);

  if (videos.length > 0) {
    product.videos = videos;
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
  subject: string | string[],
): Promise<ErpProduct[]> {
  requireErpConfig();

  const subjects = Array.from(
    new Set(
      (Array.isArray(subject) ? subject : [subject])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (subjects.length === 0) {
    return [];
  }

  const normalizedSubjects = new Set(
    subjects.map((value) => value.toLowerCase()),
  );

  const subjectFilter =
    subjects.length === 1
      ? ["Item", ERPNEXT_SUBJECT_FIELD, "=", subjects[0]]
      : ["Item", ERPNEXT_SUBJECT_FIELD, "in", subjects];

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
        subjectFilter,
      ]),
      limit_page_length: "200",
      order_by: "modified desc",
    },
  );

  const visibleItems = itemResponse.data.filter((item) => {
    const productSubject = String(item[ERPNEXT_SUBJECT_FIELD] ?? "")
      .trim()
      .toLowerCase();

    return (
      item.disabled !== 1 &&
      Number(item[ERPNEXT_WEBSITE_FIELD]) === 1 &&
      normalizedSubjects.has(productSubject)
    );
  });

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
const ERPNEXT_TERRITORY = process.env.ERPNEXT_TERRITORY ?? "All Territories";
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
  const existing = await erpGetFresh<ErpNextListResponse<{ name: string }>>(
    "/api/resource/Customer",
    {
      filters: JSON.stringify([
        ["Customer", ERPNEXT_CUSTOMER_EMAIL_FIELD, "=", email],
      ]),
      fields: JSON.stringify(["name"]),
      limit_page_length: "1",
    },
  );

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
    const recheck = await findSalesOrderByRazorpayOrderId(args.razorpayOrderId);

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

// ===========================================================================
// MY ORDERS - Customer order history from ERPNext Sales Order
// ===========================================================================

export interface CustomerOrderItem {
  itemCode: string;
  itemName: string;
  slug: string;
  qty: number;
  rate: number;
  amount: number;
  image?: string;
}

export interface CustomerOrder {
  name: string;
  transactionDate: string;
  deliveryDate?: string;
  status: string;
  docstatus: number;
  paymentStatus: string;
  grandTotal: number;
  currency: string;
  customerName?: string;
  contactEmail?: string;
  contactMobile?: string;
  addressDisplay?: string;
  notes?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  items: CustomerOrderItem[];
}

type ErpSalesOrderListRow = {
  name: string;
};

type ErpSalesOrderItemRow = {
  item_code?: string;
  item_name?: string;
  qty?: number;
  rate?: number;
  amount?: number;
  image?: string;
};

type ErpSalesOrderDoc = {
  name: string;
  transaction_date?: string;
  delivery_date?: string;
  status?: string;
  docstatus?: number;
  grand_total?: number;
  rounded_total?: number;
  currency?: string;
  customer_name?: string;
  contact_email?: string;
  contact_mobile?: string;
  address_display?: string;
  notes?: string;
  items?: ErpSalesOrderItemRow[];
  [key: string]: unknown;
};

function normalizeOrderStatus(docstatus?: number, status?: string) {
  const cleanStatus = safeTrim(status);

  if (cleanStatus) return cleanStatus;
  if (docstatus === 0) return "Draft";
  if (docstatus === 1) return "Submitted";
  if (docstatus === 2) return "Cancelled";

  return "Unknown";
}

function normalizeOrderPaymentStatus(value: unknown, docstatus?: number) {
  const clean = cleanTextValue(value);

  if (clean) return clean;
  if (docstatus === 1) return "Paid";

  return "Pending";
}

function mapSalesOrderDocToCustomerOrder(doc: ErpSalesOrderDoc): CustomerOrder {
  const paymentStatus = normalizeOrderPaymentStatus(
    doc[ERPNEXT_PAYMENT_STATUS_FIELD],
    doc.docstatus,
  );

  return {
    name: doc.name,
    transactionDate: safeTrim(doc.transaction_date),
    deliveryDate: safeTrim(doc.delivery_date) || undefined,
    status: normalizeOrderStatus(doc.docstatus, doc.status),
    docstatus: Number(doc.docstatus ?? 0),
    paymentStatus,
    grandTotal: Number(doc.rounded_total || doc.grand_total || 0),
    currency: safeTrim(doc.currency) || "INR",
    customerName: safeTrim(doc.customer_name) || undefined,
    contactEmail: safeTrim(doc.contact_email) || undefined,
    contactMobile: safeTrim(doc.contact_mobile) || undefined,
    addressDisplay: safeTrim(doc.address_display) || undefined,
    notes: cleanTextValue(doc.notes) || undefined,
    razorpayOrderId: cleanTextValue(doc[ERPNEXT_RZP_ORDER_FIELD]) || undefined,
    razorpayPaymentId:
      cleanTextValue(doc[ERPNEXT_RZP_PAYMENT_FIELD]) || undefined,
    items: (doc.items ?? []).map((item) => {
      const itemCode = safeTrim(item.item_code);
      const itemName = safeTrim(item.item_name) || itemCode;

      return {
        itemCode,
        itemName,
        slug: normalizeSlug(itemCode),
        qty: Number(item.qty || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        image: buildImageUrl(item.image)[0],
      };
    }),
  };
}

/**
 * Fetch the signed-in customer's order history from ERPNext.
 *
 * This uses Sales Order.contact_email because checkout writes the Clerk/user
 * email into the ERPNext Sales Order.
 */
export async function fetchCustomerOrdersByEmail(
  email: string,
): Promise<CustomerOrder[]> {
  const cleanEmail = safeTrim(email).toLowerCase();

  if (!cleanEmail) return [];

  const list = await erpGetFresh<ErpNextListResponse<ErpSalesOrderListRow>>(
    "/api/resource/Sales Order",
    {
      fields: JSON.stringify(["name"]),
      filters: JSON.stringify([
        ["Sales Order", "contact_email", "=", cleanEmail],
      ]),
      order_by: "creation desc",
      limit_page_length: "100",
    },
  );

  const orders = await Promise.all(
    (list.data ?? []).map(async (row) => {
      const doc = await erpGetFresh<ErpNextSingleResponse<ErpSalesOrderDoc>>(
        `/api/resource/Sales Order/${encodeURIComponent(row.name)}`,
      );

      return mapSalesOrderDocToCustomerOrder(doc.data);
    }),
  );

  return orders;
}
