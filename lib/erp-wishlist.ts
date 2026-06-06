import { fetchErpProductBySlug } from "@/lib/erpnext";

function cleanEnv(value?: string) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

const ERPNEXT_URL = cleanEnv(process.env.ERPNEXT_URL);
const ERPNEXT_API_KEY = cleanEnv(process.env.ERPNEXT_API_KEY);
const ERPNEXT_API_SECRET = cleanEnv(process.env.ERPNEXT_API_SECRET);

const ERPNEXT_WISHLIST_DOCTYPE =
  cleanEnv(process.env.ERPNEXT_WISHLIST_DOCTYPE) || "Website Wishlist";

type ErpListResponse<T> = {
  data: T[];
};

type ErpSingleResponse<T> = {
  data: T;
};

export type ErpWishlistItem = {
  name: string;
  clerk_user_id: string;
  user_email?: string;
  product_item_code?: string;
  product_name?: string;
  product_slug?: string;
  item_group?: string;
  product_image?: string;
  added_on?: string;
  active?: 0 | 1;
};

function requireErpConfig() {
  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    throw new Error(
      "ERPNext environment variables are missing. Please set ERPNEXT_URL, ERPNEXT_API_KEY and ERPNEXT_API_SECRET.",
    );
  }
}

function cleanBaseUrl() {
  return ERPNEXT_URL.replace(/\/$/, "");
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
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

/**
 * ERPNext/Frappe Datetime fields expect:
 * YYYY-MM-DD HH:mm:ss
 *
 * JavaScript's new Date().toISOString() gives:
 * YYYY-MM-DDTHH:mm:ss.sssZ
 *
 * That ISO format can fail in MariaDB/MySQL through Frappe REST insert.
 */
function getErpDatetime(date = new Date()) {
  const pad = (num: number) => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function erpGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path, params), {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ERPNext GET failed: ${res.status}. ${errorText}`);
  }

  return res.json() as Promise<T>;
}

async function erpPost<T>(path: string, body: unknown): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ERPNext POST failed: ${res.status}. ${errorText}`);
  }

  return res.json() as Promise<T>;
}

async function erpDelete<T>(path: string): Promise<T> {
  requireErpConfig();

  const res = await fetch(buildErpUrl(path), {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ERPNext DELETE failed: ${res.status}. ${errorText}`);
  }

  return res.json() as Promise<T>;
}

export async function getWishlistRecords(clerkUserId: string) {
  const response = await erpGet<ErpListResponse<ErpWishlistItem>>(
    `/api/resource/${encodeURIComponent(ERPNEXT_WISHLIST_DOCTYPE)}`,
    {
      fields: JSON.stringify([
        "name",
        "clerk_user_id",
        "user_email",
        "product_item_code",
        "product_name",
        "product_slug",
        "item_group",
        "product_image",
        "added_on",
        "active",
      ]),
      filters: JSON.stringify([
        ["clerk_user_id", "=", clerkUserId],
        ["active", "=", 1],
      ]),
      limit_page_length: "500",
      order_by: "creation desc",
    },
  );

  return response.data;
}

export async function getWishlistProducts(clerkUserId: string) {
  const records = await getWishlistRecords(clerkUserId);

  const products = await Promise.all(
    records
      .filter((record) => Boolean(record.product_slug))
      .map(async (record) => {
        try {
          const product = await fetchErpProductBySlug(record.product_slug!);

          if (!product) {
            return null;
          }

          return {
            wishlistRecordName: record.name,
            product,
          };
        } catch (error) {
          console.error("Wishlist product fetch failed:", error);
          return null;
        }
      }),
  );

  return products.filter(
    (
      item,
    ): item is {
      wishlistRecordName: string;
      product: NonNullable<Awaited<ReturnType<typeof fetchErpProductBySlug>>>;
    } => Boolean(item),
  );
}

export async function isProductWishlisted(
  clerkUserId: string,
  productSlug: string,
) {
  const response = await erpGet<ErpListResponse<{ name: string }>>(
    `/api/resource/${encodeURIComponent(ERPNEXT_WISHLIST_DOCTYPE)}`,
    {
      fields: JSON.stringify(["name"]),
      filters: JSON.stringify([
        ["clerk_user_id", "=", clerkUserId],
        ["product_slug", "=", productSlug],
        ["active", "=", 1],
      ]),
      limit_page_length: "1",
    },
  );

  return response.data[0] ?? null;
}

export async function addProductToWishlist(params: {
  clerkUserId: string;
  userEmail?: string;
  productSlug: string;
}) {
  const existing = await isProductWishlisted(
    params.clerkUserId,
    params.productSlug,
  );

  if (existing) {
    return {
      added: false,
      wishlistRecordName: existing.name,
    };
  }

  const product = await fetchErpProductBySlug(params.productSlug);

  if (!product) {
    throw new Error("Product not found.");
  }

  const response = await erpPost<ErpSingleResponse<ErpWishlistItem>>(
    `/api/resource/${encodeURIComponent(ERPNEXT_WISHLIST_DOCTYPE)}`,
    {
      clerk_user_id: params.clerkUserId,
      user_email: params.userEmail || "",
      product_item_code: product.itemCode,
      product_name: product.name,
      product_slug: product.slug,
      item_group: product.itemGroup,
      product_image: product.images?.[0] || "",
      added_on: getErpDatetime(),
      active: 1,
    },
  );

  return {
    added: true,
    wishlistRecordName: response.data.name,
  };
}

export async function removeProductFromWishlist(params: {
  clerkUserId: string;
  productSlug: string;
}) {
  const existing = await isProductWishlisted(
    params.clerkUserId,
    params.productSlug,
  );

  if (!existing) {
    return {
      removed: false,
    };
  }

  await erpDelete(
    `/api/resource/${encodeURIComponent(
      ERPNEXT_WISHLIST_DOCTYPE,
    )}/${encodeURIComponent(existing.name)}`,
  );

  return {
    removed: true,
  };
}