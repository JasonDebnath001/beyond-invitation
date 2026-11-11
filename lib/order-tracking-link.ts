const ORDER_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function trackingTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token && TOKEN.test(token) ? token : null;
}

export function privateTrackingLink(orderId: unknown, token: unknown): string | null {
  if (typeof orderId !== "string" || !ORDER_ID.test(orderId) ||
      typeof token !== "string" || !TOKEN.test(token)) return null;
  return `/track-order?order=${encodeURIComponent(orderId)}#token=${encodeURIComponent(token)}`;
}
