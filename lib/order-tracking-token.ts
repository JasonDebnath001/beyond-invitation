import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[a-f0-9]{64}$/;

/** One private capability per checkout. Only its hash is stored with the order. */
export function createOrderTrackingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function verifyOrderTrackingToken(token: unknown, hash: unknown): boolean {
  if (typeof token !== "string" || !TOKEN.test(token) ||
      typeof hash !== "string" || !HASH.test(hash)) return false;
  const candidate = createHash("sha256").update(token).digest();
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}
