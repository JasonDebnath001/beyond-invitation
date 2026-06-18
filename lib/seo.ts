import { getSiteUrl } from "./site-config";

const DEFAULT_SITE_URL = "https://www.beyondinvitation.co.in";

function ensureAbsoluteUrl(value?: string | null) {
  const clean = (value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/$/, "");

  if (!clean) return "";

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  return `https://${clean}`;
}

function getErpPublicUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_ERPNEXT_URL || process.env.ERPNEXT_URL || "";

  return ensureAbsoluteUrl(fromEnv);
}

export function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return undefined;

  const value = pathOrUrl.trim();

  if (!value) return undefined;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/files/") || value.startsWith("/private/files/")) {
    const erpUrl = getErpPublicUrl();
    return erpUrl ? `${erpUrl}${value}` : `${getSiteUrl() || DEFAULT_SITE_URL}${value}`;
  }

  if (value.startsWith("/")) {
    return `${getSiteUrl() || DEFAULT_SITE_URL}${value}`;
  }

  return `${getSiteUrl() || DEFAULT_SITE_URL}/products/${value}`;
}

export default absoluteUrl;
