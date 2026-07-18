import { cookies } from "next/headers";
import type { Product } from "@/types";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function cleanEnv(value?: string) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

const ERPNEXT_URL = cleanEnv(process.env.ERPNEXT_URL);
const ERPNEXT_API_KEY = cleanEnv(process.env.ERPNEXT_API_KEY);
const ERPNEXT_API_SECRET = cleanEnv(process.env.ERPNEXT_API_SECRET);

const RESELLER_DOCTYPE =
  cleanEnv(process.env.ERPNEXT_RESELLER_DOCTYPE) || "Website Reseller";

export const RESELLER_MAX_MARGIN = Number(
  cleanEnv(process.env.RESELLER_MAX_MARGIN_PERCENT) || "100",
);

/**
 * Deliberately bland names so nothing customer-visible says "reseller".
 * The URL param is ?via=CODE and the cookie is bi_pref.
 */
export const RESELLER_URL_PARAM = "via";
export const RESELLER_COOKIE = "bi_pref";
export const RESELLER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Reseller {
  /** ERP document name */
  docName: string;
  code: string;
  clerkUserId: string;
  resellerName: string;
  email: string;
  phone: string;
  marginPercent: number;
  active: boolean;
}

type ErpResellerDoc = {
  name: string;
  reseller_code?: string;
  clerk_user_id?: string;
  reseller_name?: string;
  email?: string;
  phone?: string;
  margin_percent?: number;
  active?: 0 | 1;
};

/* ------------------------------------------------------------------ */
/* ERP HTTP helpers                                                    */
/* ------------------------------------------------------------------ */

function requireErpConfig() {
  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    throw new Error(
      "ERPNext environment variables are missing. Please set ERPNEXT_URL, ERPNEXT_API_KEY and ERPNEXT_API_SECRET.",
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

function buildErpUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${ERPNEXT_URL.replace(/\/$/, "")}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}

function mapDoc(doc: ErpResellerDoc): Reseller {
  return {
    docName: doc.name,
    code: String(doc.reseller_code ?? "").toUpperCase(),
    clerkUserId: String(doc.clerk_user_id ?? ""),
    resellerName: String(doc.reseller_name ?? ""),
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    marginPercent: clampMargin(Number(doc.margin_percent ?? 0)),
    active: Number(doc.active ?? 0) === 1,
  };
}

async function erpList(
  filters: unknown[][],
): Promise<ErpResellerDoc | null> {
  requireErpConfig();

  const res = await fetch(
    buildErpUrl(`/api/resource/${encodeURIComponent(RESELLER_DOCTYPE)}`, {
      fields: JSON.stringify([
        "name",
        "reseller_code",
        "clerk_user_id",
        "reseller_name",
        "email",
        "phone",
        "margin_percent",
        "active",
      ]),
      filters: JSON.stringify(filters),
      limit_page_length: "1",
    }),
    { headers: authHeaders(), cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `ERPNext reseller lookup failed: ${res.status} ${res.statusText}. ${text}`,
    );
  }

  const json = (await res.json()) as { data: ErpResellerDoc[] };
  const doc = json.data?.[0];
  return doc ? doc : null;
}

/* ------------------------------------------------------------------ */
/* Cached lookup by code (used on every priced request)                */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 60 * 1000;
const codeCache = new Map
  string,
  { reseller: Reseller | null; expiresAt: number }
>();

export async function getResellerByCode(
  rawCode: string,
): Promise<Reseller | null> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return null;

  const cached = codeCache.get(code);
  if (cached && Date.now() < cached.expiresAt) return cached.reseller;

  let reseller: Reseller | null = null;
  try {
    const doc = await erpList([[RESELLER_DOCTYPE, "reseller_code", "=", code]]);
    reseller = doc ? mapDoc(doc) : null;
  } catch (error) {
    console.error("Reseller lookup failed for code", code, error);
    reseller = null;
  }

  codeCache.set(code, { reseller, expiresAt: Date.now() + CACHE_TTL });
  return reseller;
}

export function invalidateResellerCache(code?: string) {
  if (code) codeCache.delete(code.trim().toUpperCase());
  else codeCache.clear();
}

export async function getResellerByClerkId(
  clerkUserId: string,
): Promise<Reseller | null> {
  if (!clerkUserId) return null;
  const doc = await erpList([
    [RESELLER_DOCTYPE, "clerk_user_id", "=", clerkUserId],
  ]);
  return doc ? mapDoc(doc) : null;
}

/* ------------------------------------------------------------------ */
/* Create / update                                                     */
/* ------------------------------------------------------------------ */

function generateCode() {
  // No 0/O/1/I to keep codes unambiguous when spoken or typed.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), RESELLER_MAX_MARGIN);
}

export async function createReseller(args: {
  clerkUserId: string;
  resellerName: string;
  email: string;
  phone?: string;
  marginPercent: number;
}): Promise<Reseller> {
  requireErpConfig();

  const payload = {
    reseller_code: generateCode(),
    clerk_user_id: args.clerkUserId,
    reseller_name: args.resellerName,
    email: args.email,
    phone: args.phone ?? "",
    margin_percent: clampMargin(args.marginPercent),
    active: 1,
  };

  const res = await fetch(
    buildErpUrl(`/api/resource/${encodeURIComponent(RESELLER_DOCTYPE)}`),
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `ERPNext reseller create failed: ${res.status} ${res.statusText}. ${text}`,
    );
  }

  const json = (await res.json()) as { data: ErpResellerDoc };
  return mapDoc({ ...payload, name: json.data.name } as ErpResellerDoc);
}

export async function updateResellerMargin(
  docName: string,
  marginPercent: number,
): Promise<number> {
  requireErpConfig();

  const clamped = clampMargin(marginPercent);

  const res = await fetch(
    buildErpUrl(
      `/api/resource/${encodeURIComponent(RESELLER_DOCTYPE)}/${encodeURIComponent(docName)}`,
    ),
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ margin_percent: clamped }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `ERPNext reseller update failed: ${res.status} ${res.statusText}. ${text}`,
    );
  }

  invalidateResellerCache();
  return clamped;
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Single rounding rule used by BOTH the display layer and checkout,
 * so the customer is always charged exactly what they saw.
 */
export function applyMarginToPrice(price: number, marginPercent: number) {
  const base = Number(price) || 0;
  const pct = clampMargin(marginPercent);
  if (base <= 0 || pct <= 0) return base;
  return Math.round(base * (1 + pct / 100));
}

/**
 * Read the reseller cookie for the current request.
 * Safe to call anywhere on the server: outside a request scope
 * (e.g. build-time) it simply returns null.
 */
export async function getActiveResellerFromCookies(): Promise<Reseller | null> {
  let code = "";
  try {
    const store = await cookies();
    code = store.get(RESELLER_COOKIE)?.value ?? "";
  } catch {
    return null; // not in a request scope
  }

  if (!code) return null;

  const reseller = await getResellerByCode(code);
  if (!reseller || !reseller.active) return null;
  return reseller;
}

/**
 * Re-price a product for the active reseller. MRP is scaled by the same
 * factor so the discount badge stays visually consistent.
 */
export function repriceProduct<T extends Product>(
  product: T,
  reseller: Reseller,
): T {
  if (reseller.marginPercent <= 0) return product;

  return {
    ...product,
    price: applyMarginToPrice(product.price, reseller.marginPercent),
    mrp:
      product.mrp > 0
        ? applyMarginToPrice(product.mrp, reseller.marginPercent)
        : product.mrp,
  };
}

export async function applyResellerPricingToProducts<T extends Product>(
  products: T[],
): Promise<T[]> {
  const reseller = await getActiveResellerFromCookies();
  if (!reseller) return products;
  return products.map((p) => repriceProduct(p, reseller));
}

export async function applyResellerPricingToProduct<T extends Product>(
  product: T | null,
): Promise<T | null> {
  if (!product) return null;
  const reseller = await getActiveResellerFromCookies();
  if (!reseller) return product;
  return repriceProduct(product, reseller);
}