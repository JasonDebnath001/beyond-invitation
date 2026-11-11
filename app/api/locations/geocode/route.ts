import { NextResponse } from "next/server";
import { normalizeDeliveryAddress } from "@/lib/delivery-address";
import {
  AddressGeocodingError,
  lookupDeliveryAddress,
} from "@/lib/address-geocoding";
import {
  AddressGeocodingBudgetError,
  claimAddressGeocodingBudget,
} from "@/lib/address-geocoding-budget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const BODY_LIMIT = 4 * 1024;

class RequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "INVALID_ADDRESS",
  ) {
    super(message);
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new RequestError("Send the delivery address as JSON.", 415);
  if (Number(request.headers.get("content-length")) > BODY_LIMIT)
    throw new RequestError("The delivery address is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Enter the full delivery address.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) {
        await reader.cancel();
        throw new RequestError("The delivery address is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new RequestError("Enter a valid delivery address.");
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new RequestError(
        "Use this website to look up your delivery address.",
        403,
        "INVALID_ORIGIN",
      );
    const body = await readBody(request);
    const address = normalizeDeliveryAddress(body.address);
    if (!address)
      throw new RequestError(
        "Enter your full delivery address, city, state and six-digit pincode.",
      );
    claimAddressGeocodingBudget(request);
    return NextResponse.json(await lookupDeliveryAddress(address), { headers });
  } catch (error) {
    if (error instanceof RequestError || error instanceof AddressGeocodingError ||
        error instanceof AddressGeocodingBudgetError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers },
      );
    const unavailable = new AddressGeocodingError();
    return NextResponse.json(
      { error: unavailable.message, code: unavailable.code },
      { status: unavailable.status, headers },
    );
  }
}
