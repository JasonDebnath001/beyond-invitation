const DEFAULT_SITE_URL = "https://www.beyondinvitation.co.in";

function normalizeUrl(value?: string | null) {
  const clean = (value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/$/, "");

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  return `https://${clean}`;
}

export const SITE_NAME = "Beyond Invitation";
export const BRAND_NAME = "Bharat Agency Wedding Cards Pvt. Ltd.";
export const DEFAULT_OG_IMAGE = "/logo.png";

export const SITE_DESCRIPTION =
  "Shop premium wedding cards, wedding invitation cards, shagun envelopes, shagun boxes, rakhi packaging, and custom invitation stationery from Beyond Invitation in Kolkata.";

export const PRIMARY_KEYWORDS = [
  "wedding cards",
  "wedding card",
  "wedding cards Kolkata",
  "wedding invitation cards",
  "wedding invitation cards Kolkata",
  "wedding cards online India",
  "Indian wedding cards",
  "Hindu wedding cards",
  "Muslim wedding cards",
  "Christian wedding cards",
  "premium wedding cards",
  "custom wedding invitations",
  "invitation printing Kolkata",
  "shagun envelopes",
  "shagun boxes",
  "rakhi packaging",
  "Beyond Invitation",
];

export const BUSINESS_ADDRESS = {
  streetAddress: "Shop No. 8, Indra Kumar Karnani St, China Bazar, B.B.D. Bagh",
  addressLocality: "Kolkata",
  addressRegion: "West Bengal",
  postalCode: "700001",
  addressCountry: "IN",
};

export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL;

  return normalizeUrl(fromEnv) || DEFAULT_SITE_URL;
}

export function siteUrl(path = "/") {
  const base = getSiteUrl();

  if (!path || path === "/") return base;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}