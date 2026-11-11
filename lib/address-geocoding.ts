import "server-only";

import {
  normalizeDeliveryAddress,
  type DeliveryAddressInput,
} from "@/lib/delivery-address";

const GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const RESPONSE_LIMIT = 64 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const UNAVAILABLE_MESSAGE =
  "Automatic address lookup is temporarily unavailable. Please try again or select standard delivery.";

export type AddressGeocodingResult = {
  provider: "google";
  status: "matched" | "review" | "not_found";
  location?: { latitude: number; longitude: number };
  /** Only a confirmed address match supplies an identifier that can be saved. */
  placeId?: string;
  label?: string;
};

export class AddressGeocodingError extends Error {
  readonly code = "GEOCODING_UNAVAILABLE";
  readonly status = 503;
  constructor() {
    super(UNAVAILABLE_MESSAGE);
    this.name = "AddressGeocodingError";
  }
}

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const strings = (value: unknown): string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
const validPlaceId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,512}$/.test(value);

async function readResponse(response: Response): Promise<unknown> {
  if (
    Number(response.headers.get("content-length")) > RESPONSE_LIMIT ||
    !response.body
  )
    throw new AddressGeocodingError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > RESPONSE_LIMIT) {
        await reader.cancel();
        throw new AddressGeocodingError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

type AddressComponent = { types: string[]; names: string[] };
type Candidate = {
  latitude: number;
  longitude: number;
  placeId: string | null;
  precise: boolean;
};

const roadAbbreviations: Record<string, string> = {
  rd: "road", st: "street", ln: "lane", ave: "avenue",
};
const words = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("en-IN")
    .replace(/\b(?:rd|st|ln|ave)\b/g, (word) =>
      roadAbbreviations[word] ?? word)
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

function includesName(address: string, name: string) {
  const normalized = words(name);
  return normalized.length >= 3 && /\p{L}/u.test(normalized) &&
    ` ${words(address)} `.includes(` ${normalized} `);
}

function houseNumber(value: string): string | null {
  const withoutPrefix = value.normalize("NFKC").trim().replace(
    /^(?:house|plot|building|door|premise)(?:\s+(?:no\.?|number))?\s*[:#-]?\s*/i,
    "",
  );
  const match = withoutPrefix.match(/^(\d+[a-z]?(?:\s*[/-]\s*\d+[a-z]?)*)(?=$|[\s,])/i);
  return match ? match[1].replace(/\s/g, "").toLowerCase() : null;
}

/** A rooftop alone does not prove that Google found the requested building. */
function matchesAddress(components: AddressComponent[], address: DeliveryAddressInput) {
  const namesFor = (type: string) => components
    .filter((component) => component.types.includes(type))
    .flatMap((component) => component.names);
  const expectedNumber = houseNumber(address.addressLine1);
  const premises = namesFor("premise");
  const numbered = [...namesFor("street_number"), ...premises]
    .some((name) => houseNumber(name) === expectedNumber && expectedNumber !== null);
  const named = premises.some((name) => includesName(address.addressLine1, name));
  if (expectedNumber ? !numbered : !named) return false;

  // A secondary-line landmark must not replace the street/area in the primary address.
  const primary = expectedNumber ? address.addressLine1
    : `${address.addressLine1}, ${address.addressLine2}`;
  const routes = namesFor("route");
  if (routes.length) return routes.some((name) => includesName(primary, name));
  return components.some((component) =>
    component.types.some((type) => type === "neighborhood" || /^sublocality(?:_level_\d+)?$/.test(type)) &&
    component.names.some((name) => includesName(primary, name)));
}

/** Administrative centroids and mismatched buildings never become rider destinations. */
function candidate(value: unknown, address: DeliveryAddressInput): Candidate | null {
  const item = object(value);
  if (!item || !Array.isArray(item.address_components) || item.address_components.length > 50)
    return null;
  const components: AddressComponent[] = item.address_components.flatMap((value) => {
    const component = object(value);
    if (!component) return [];
    const names = [component.long_name, component.short_name]
      .filter((name): name is string => typeof name === "string" && name.length <= 300);
    return [{ types: strings(component.types), names }];
  });
  const country = item.address_components.map(object)
    .find((component) => strings(component?.types).includes("country"));
  const postcodes = components.filter((component) => component.types.includes("postal_code"));
  const geometry = object(item.geometry);
  const location = object(geometry?.location);
  if (
    country?.short_name !== "IN" ||
    !postcodes.some((component) => component.names.includes(address.pincode)) ||
    typeof location?.lat !== "number" || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 ||
    typeof location.lng !== "number" || !Number.isFinite(location.lng) || Math.abs(location.lng) > 180
  ) return null;
  const placeId = validPlaceId(item.place_id) ? item.place_id : null;
  const precise = !!placeId && geometry?.location_type === "ROOFTOP" &&
    (item.partial_match === undefined || item.partial_match === false) &&
    strings(item.types).some((type) => ["street_address", "premise", "subpremise"].includes(type)) &&
    matchesAddress(components, address);
  return { latitude: location.lat, longitude: location.lng, placeId, precise };
}

async function requestGeocoding(
  parameters: Record<string, string>,
  address: DeliveryAddressInput,
): Promise<AddressGeocodingResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new AddressGeocodingError();
  const url = new URL(GEOCODING_URL);
  url.search = new URLSearchParams({ ...parameters, language: "en", key: apiKey }).toString();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET", headers: { Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok) throw new AddressGeocodingError();
    const body = object(await readResponse(response));
    if (!body || !Array.isArray(body.results) || body.results.length > 10 ||
        !["OK", "ZERO_RESULTS"].includes(String(body.status)) ||
        (body.status === "ZERO_RESULTS" && body.results.length !== 0) ||
        (body.status === "OK" && body.results.length === 0) || controller.signal.aborted)
      throw new AddressGeocodingError();
    const candidates = body.results.map((result) => candidate(result, address))
      .filter((result): result is Candidate => !!result);
    if (!candidates.length) return { provider: "google", status: "not_found" };

    // Weaker area results do not make one matching rooftop ambiguous. Keep the
    // strongest evidence when duplicate records describe the same point.
    const precise = candidates.filter((entry) => entry.precise);
    const distinct = precise.filter((entry, index, values) => values.findIndex((other) =>
      other.latitude === entry.latitude && other.longitude === entry.longitude) === index);
    const matched = distinct.length === 1;
    const preferred = distinct[0] ?? candidates[0];
    return {
      provider: "google", status: matched ? "matched" : "review",
      location: { latitude: preferred.latitude, longitude: preferred.longitude },
      ...(matched && preferred.placeId ? { placeId: preferred.placeId } : {}),
      label: matched ? "Delivery address located"
        : "Approximate address match — please check your building and street details",
    };
  } catch {
    throw new AddressGeocodingError();
  } finally {
    clearTimeout(deadline);
  }
}

/** One server-only lookup; no addresses or coordinates are logged or cached. */
export async function lookupDeliveryAddress(input: DeliveryAddressInput): Promise<AddressGeocodingResult> {
  const address = normalizeDeliveryAddress(input);
  if (!address) throw new AddressGeocodingError();
  return requestGeocoding({
    address: [address.addressLine1, address.addressLine2, address.city, address.state,
      address.pincode, address.country].filter(Boolean).join(", "),
    components: `country:IN|postal_code:${address.pincode}`,
  }, address);
}

/** Resolve a saved identifier afresh, and recheck it against the customer's address. */
export async function lookupDeliveryPlace(placeId: string, input: DeliveryAddressInput): Promise<AddressGeocodingResult> {
  const address = normalizeDeliveryAddress(input);
  if (!address || !validPlaceId(placeId)) throw new AddressGeocodingError();
  return requestGeocoding({ place_id: placeId }, address);
}
