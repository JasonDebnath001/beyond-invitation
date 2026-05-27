import type { Product, ProductCategory } from "@/types";

/*
 * ERPNEXT INTEGRATION (NOT YET ACTIVE)
 * ------------------------------------
 * This file is a ready-to-use template for connecting to ERPNext.
 * Currently the app uses dummy data via lib/products.ts.
 *
 * TO GO LIVE WITH ERPNEXT:
 *   1. Fill in the .env values below.
 *   2. Implement the functions in this file (skeletons provided).
 *   3. In lib/products.ts, replace the JSON lookups with calls to these
 *      functions. Because the function signatures match, no component changes.
 *
 * Required environment variables (create a .env.local file):
 *   ERPNEXT_URL=https://your-erpnext-site.com
 *   ERPNEXT_API_KEY=xxxxxxxxxxxxx
 *   ERPNEXT_API_SECRET=xxxxxxxxxxxxx
 */

const ERPNEXT_URL = process.env.ERPNEXT_URL ?? "";
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY ?? "";
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET ?? "";

/** Standard auth header for ERPNext token-based API access. */
function authHeaders(): HeadersInit {
  return {
    Authorization: `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}`,
    "Content-Type": "application/json",
  };
}

/**
 * Maps an ERPNext "Item" doctype record to our app's Product shape.
 * Adjust the field names to match your ERPNext Item custom fields.
 */
interface ErpItem {
  name: string;
  item_name: string;
  standard_rate: number;
  // Add custom field names as configured in your ERPNext instance.
  [key: string]: unknown;
}

function mapErpItemToProduct(item: ErpItem): Product {
  return {
    slug: item.name,
    name: item.item_name,
    price: item.standard_rate,
    mrp: (item.mrp as number) ?? item.standard_rate,
    images: (item.images as string[]) ?? [],
    emoji: "🎴",
    category: ((item.item_group as string) ?? "wedding") as ProductCategory,
    description: (item.description as string) ?? "",
  };
}

/**
 * Fetch all items from ERPNext.
 * Uncomment and adjust when ready to go live.
 */
export async function fetchErpProducts(): Promise<Product[]> {
  if (!ERPNEXT_URL) {
    throw new Error("ERPNEXT_URL is not configured. See lib/erpnext.ts.");
  }

  const res = await fetch(
    `${ERPNEXT_URL}/api/resource/Item?fields=["*"]&limit_page_length=0`,
    { headers: authHeaders(), next: { revalidate: 300 } },
  );

  if (!res.ok) {
    throw new Error(`ERPNext request failed: ${res.status}`);
  }

  const json = (await res.json()) as { data: ErpItem[] };
  return json.data.map(mapErpItemToProduct);
}

/**
 * Create a Sales Order in ERPNext — used when a customer places an order.
 */
export async function createErpSalesOrder(payload: {
  customer: string;
  items: { item_code: string; qty: number }[];
}): Promise<{ orderId: string }> {
  if (!ERPNEXT_URL) {
    throw new Error("ERPNEXT_URL is not configured. See lib/erpnext.ts.");
  }

  const res = await fetch(`${ERPNEXT_URL}/api/resource/Sales Order`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`ERPNext Sales Order failed: ${res.status}`);
  }

  const json = (await res.json()) as { data: { name: string } };
  return { orderId: json.data.name };
}

/**
 * Create a Lead in ERPNext CRM — used by the website enquiry/contact form.
 */
export async function createErpLead(payload: {
  lead_name: string;
  email_id: string;
  mobile_no: string;
  notes?: string;
}): Promise<{ leadId: string }> {
  if (!ERPNEXT_URL) {
    throw new Error("ERPNEXT_URL is not configured. See lib/erpnext.ts.");
  }

  const res = await fetch(`${ERPNEXT_URL}/api/resource/Lead`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`ERPNext Lead failed: ${res.status}`);
  }

  const json = (await res.json()) as { data: { name: string } };
  return { leadId: json.data.name };
}
