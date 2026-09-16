import { getSiteUrl } from "./site-config";

const DEFAULT_SITE_URL = "https://www.beyondinvitation.co.in";

export function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return undefined;

  const value = pathOrUrl.trim();

  if (!value) return undefined;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${getSiteUrl() || DEFAULT_SITE_URL}${value}`;
  }

  return `${getSiteUrl() || DEFAULT_SITE_URL}/products/${value}`;
}

export default absoluteUrl;
