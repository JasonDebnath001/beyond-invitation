const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { isIP } = require("node:net");

function load(file, imports = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
    return imports[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

const delivery = load("lib/delivery-address.ts", { "@/lib/shipping": load("lib/shipping.ts") });
const address = { addressLine1: "1 Example Road", addressLine2: "Flat 2", city: "Kolkata", state: "West Bengal", pincode: "700001", country: "India" };
const component = (type, name, shortName = name) => ({ types: [type], long_name: name, short_name: shortName });
const baseComponents = () => [component("street_number", "1"), component("route", "Example Road", "Example Rd"),
  component("locality", "Kolkata"), component("administrative_area_level_1", "West Bengal", "WB"),
  component("country", "India", "IN"), component("postal_code", "700001")];
const withComponent = (type, name, shortName = name) => [...baseComponents().filter(c => !c.types.includes(type)), component(type, name, shortName)];
const result = (overrides = {}) => ({
  address_components: baseComponents(), types: ["street_address"], place_id: "test-place-1",
  geometry: { location: { lat: 22.5726, lng: 88.3639 }, location_type: "ROOFTOP" },
  formatted_address: "PRIVATE PROVIDER ADDRESS", apiKey: "PRIVATE UPSTREAM SECRET", ...overrides,
});
const responseFor = (results) => Response.json({ status: results.length ? "OK" : "ZERO_RESULTS", results });
function providerFixture({ key = "PRIVATE TEST API KEY", response = () => responseFor([result()]), timeout = false } = {}) {
  const calls = [];
  const deadlines = [];
  let fireTimeout;
  const api = load("lib/address-geocoding.ts", { "server-only": {}, "@/lib/delivery-address": delivery }, {
    process: { env: { GOOGLE_MAPS_API_KEY: key } },
    setTimeout(callback, milliseconds) { deadlines.push(milliseconds); fireTimeout = callback; return 1; },
    clearTimeout() {},
    fetch: async (url, options) => {
      calls.push({ url: new URL(url), options });
      if (timeout) return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error(`PRIVATE ${url}`)), { once: true });
        fireTimeout();
      });
      return response(url, options, fireTimeout);
    },
  });
  return { api, calls, deadlines };
}

test("Google forward geocoding sends only bounded address fields and accepts a matching rooftop", async () => {
  const fixture = providerFixture();
  const found = await fixture.api.lookupDeliveryAddress({ ...address, name: "PRIVATE NAME", email: "PRIVATE EMAIL", contact: "PRIVATE PHONE", notes: "PRIVATE NOTE" });
  assert.deepEqual(found, { provider: "google", status: "matched", placeId: "test-place-1", location: { latitude: 22.5726, longitude: 88.3639 }, label: "Delivery address located" });
  assert.equal(fixture.calls.length, 1);
  const { url, options } = fixture.calls[0];
  assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/geocode/json");
  assert.equal(url.searchParams.get("address"), "1 Example Road, Flat 2, Kolkata, West Bengal, 700001, India");
  assert.equal(url.searchParams.get("components"), "country:IN|postal_code:700001");
  assert.equal(url.searchParams.get("language"), "en");
  assert.equal(url.searchParams.get("key"), "PRIVATE TEST API KEY");
  assert.equal(options.cache, "no-store");
  assert.equal(options.redirect, "error");
  assert.equal(options.method, "GET");
  assert.deepEqual(fixture.deadlines, [8000]);
  assert.doesNotMatch(url.searchParams.get("address"), /PRIVATE/);
  assert.doesNotMatch(JSON.stringify(found), /PRIVATE|Example Road|apiKey|postcode|formatted_address/);
});

test("missing Google key or incomplete address never contacts the geocoder", async () => {
  for (const [options, input] of [[{ key: "" }, address], [{}, { ...address, pincode: "" }], [{}, { ...address, country: "USA" }]]) {
    const fixture = providerFixture(options);
    await assert.rejects(fixture.api.lookupDeliveryAddress(input), (error) => error.code === "GEOCODING_UNAVAILABLE" && !/PRIVATE/.test(error.message));
    assert.equal(fixture.calls.length, 0);
  }
});

test("wrong PIN, country, missing postcode and invalid coordinates cannot locate the delivery destination", async () => {
  const changes = [
    { address_components: withComponent("postal_code", "700002") },
    { address_components: withComponent("postal_code", 700001) },
    { address_components: baseComponents().filter(c => !c.types.includes("postal_code")) },
    { address_components: withComponent("country", "United States", "US") },
    { address_components: baseComponents().filter(c => !c.types.includes("country")) },
    { address_components: null },
  ];
  for (const point of [{ lat: "22.57", lng: 88.36 }, { lat: null, lng: 88.36 }, { lat: 22.57, lng: 181 },
    { lat: -91, lng: 88.36 }, { lat: 22.57, lng: null }]) changes.push({ geometry: { location: point, location_type: "ROOFTOP" } });
  for (const change of changes) {
    const fixture = providerFixture({ response: () => responseFor([result(change)]) });
    assert.deepEqual(await fixture.api.lookupDeliveryAddress(address), { provider: "google", status: "not_found" });
  }
});

test("partial, interpolated, area-only and unidentified matches never become confirmed Quick points", async () => {
  const changes = [ { partial_match: true }, { partial_match: "false" }, { types: ["route"] }, { types: ["postal_code"] },
    { types: ["locality"] }, { types: ["point_of_interest"] }, { place_id: undefined }, { place_id: "bad id" },
    { place_id: "x".repeat(513) }, { address_components: withComponent("street_number", "11") },
    { address_components: withComponent("route", "Different Road") },
    { address_components: baseComponents().filter(c => !c.types.includes("street_number")) },
  ];
  for (const location_type of ["APPROXIMATE", "RANGE_INTERPOLATED", "GEOMETRIC_CENTER", undefined]) {
    changes.push({ geometry: { location: { lat: 22.5726, lng: 88.3639 }, location_type } });
  }
  for (const change of changes) {
    const fixture = providerFixture({ response: () => responseFor([result(change)]) });
    const found = await fixture.api.lookupDeliveryAddress(address);
    assert.equal(found.status, "review", JSON.stringify(change));
    assert.equal(found.placeId, undefined);
    assert.match(found.label, /Approximate/);
  }
});

test("numbered premises without route components match their primary neighborhood and house number", async () => {
  const input = { ...address, addressLine1: "19, Garden Colony, South Park", addressLine2: "Nearby Main Road" };
  const components = [component("premise", "19"), component("sublocality_level_2", "Garden Colony"),
    ...baseComponents().filter(c => !c.types.includes("route") && !c.types.includes("street_number"))];
  const fixture = providerFixture({ response: () => responseFor([result({ address_components: components, types: ["premise", "street_address"] })]) });
  assert.equal((await fixture.api.lookupDeliveryAddress(input)).status, "matched");
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...input, addressLine1: "18, Garden Colony, South Park" })).status, "review");
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...input, addressLine1: "19, Different Colony, South Park" })).status, "review");
});

test("secondary landmarks cannot substitute for a different street in the primary delivery address", async () => {
  const fixture = providerFixture({ response: () => responseFor([result({ address_components: withComponent("route", "Landmark Road") })]) });
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...address, addressLine2: "Near Landmark Road" })).status, "review");
});

test("named premises need the named building and a matching street or neighborhood", async () => {
  const components = [...baseComponents().filter(c => !c.types.includes("street_number")), component("premise", "Rose Apartments")];
  const fixture = providerFixture({ response: () => responseFor([result({ address_components: components, types: ["premise"] })]) });
  const input = { ...address, addressLine1: "Rose Apartments", addressLine2: "Example Road" };
  assert.equal((await fixture.api.lookupDeliveryAddress(input)).status, "matched");
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...input, addressLine1: "Other Apartments" })).status, "review");
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...input, addressLine2: "Other Road" })).status, "review");
});

test("street abbreviations and house-number punctuation normalize without conflating different houses", async () => {
  const fixture = providerFixture();
  assert.equal((await fixture.api.lookupDeliveryAddress({ ...address, addressLine1: "House No. 1, Example Rd" })).status, "matched");
  for (const addressLine1 of ["11 Example Road", "1A Example Road", "1/2 Example Road", "1-2 Example Road"])
    assert.equal((await fixture.api.lookupDeliveryAddress({ ...address, addressLine1 })).status, "review");
});

test("competing precise rooftops require review while coarse alternatives and duplicates do not", async () => {
  const other = result({ place_id: "test-place-2", geometry: { location_type: "ROOFTOP", location: { lat: 22.58, lng: 88.37 } } });
  const ambiguous = providerFixture({ response: () => responseFor([result(), other]) });
  const found = await ambiguous.api.lookupDeliveryAddress(address);
  assert.equal(found.status, "review");
  assert.equal(found.placeId, undefined);
  const coarse = result({ types: ["postal_code"], geometry: { location_type: "APPROXIMATE", location: { lat: 22.59, lng: 88.39 } } });
  for (const candidates of [[result(), result()], [result(), coarse], [coarse, result()],
    [result({ types: ["route"] }), result()]]) {
    const fixture = providerFixture({ response: () => responseFor(candidates) });
    assert.equal((await fixture.api.lookupDeliveryAddress(address)).status, "matched");
  }
});

test("saved place resolution sends only its identifier and revalidates the complete delivery address", async () => {
  const fixture = providerFixture();
  const found = await fixture.api.lookupDeliveryPlace("test-place-1", address);
  assert.equal(found.status, "matched");
  assert.equal(found.placeId, "test-place-1");
  assert.equal(fixture.calls[0].url.searchParams.get("place_id"), "test-place-1");
  assert.equal(fixture.calls[0].url.searchParams.has("address"), false);
  assert.equal(fixture.calls[0].url.searchParams.has("components"), false);
  assert.equal((await fixture.api.lookupDeliveryPlace("test-place-1", { ...address, addressLine1: "11 Example Road" })).status, "review");
  assert.equal((await fixture.api.lookupDeliveryPlace("test-place-1", { ...address, pincode: "700002" })).status, "not_found");
  const missing = providerFixture({ response: () => responseFor([]) });
  assert.equal((await missing.api.lookupDeliveryPlace("test-place-1", address)).status, "not_found");
  for (const invalid of ["", "a b", "x".repeat(513), null, "https://example.test/"]) {
    const bad = providerFixture();
    await assert.rejects(bad.api.lookupDeliveryPlace(invalid, address), { code: "GEOCODING_UNAVAILABLE" });
    assert.equal(bad.calls.length, 0);
  }
});

test("Google zero results differ from HTTP-200 API errors, malformed and oversized responses; errors stay sanitized", async () => {
  const none = providerFixture({ response: () => responseFor([]) });
  assert.deepEqual(await none.api.lookupDeliveryAddress(address), { provider: "google", status: "not_found" });
  const responses = [() => Response.json({ error: "PRIVATE secret/address" }, { status: 401 }),
    () => Response.json({ error: "PRIVATE rate" }, { status: 429 }), () => new Response("PRIVATE broken JSON"),
    () => Response.json({ status: "OK", results: {} }), () => Response.json({ status: "OK", results: [] }),
    () => Response.json({ status: "ZERO_RESULTS", results: [result()] }),
    () => responseFor(Array.from({ length: 11 }, () => result())),
    () => new Response("x".repeat(66_000)), () => new Response("{}", { headers: { "content-length": "70000" } }),
    () => { throw new Error("PRIVATE apiKey and address"); }];
  for (const status of ["REQUEST_DENIED", "OVER_DAILY_LIMIT", "OVER_QUERY_LIMIT", "INVALID_REQUEST", "UNKNOWN_ERROR", undefined])
    responses.push(() => Response.json({ status, error_message: "PRIVATE account/address/key", results: [] }));
  for (const response of responses) {
    const fixture = providerFixture({ response });
    await assert.rejects(fixture.api.lookupDeliveryAddress(address), (error) => error.status === 503 && error.code === "GEOCODING_UNAVAILABLE" && !/PRIVATE|apiKey|700001/.test(error.message));
    assert.equal(fixture.calls.length, 1, "Errors never retry the provider");
  }
});

test("the entire provider call has an eight-second abort deadline and timeout never retries", async () => {
  const fixture = providerFixture({ timeout: true });
  await assert.rejects(fixture.api.lookupDeliveryAddress(address), { code: "GEOCODING_UNAVAILABLE" });
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].options.signal.aborted, true);
  const late = providerFixture({ response: (_url, _options, expire) => { expire(); return responseFor([result()]); } });
  await assert.rejects(late.api.lookupDeliveryAddress(address), { code: "GEOCODING_UNAVAILABLE" });
});

function routeFixture({ lookup, dailyLimit } = {}) {
  const calls = [];
  let now = Date.parse("2026-11-11T10:00:00Z");
  class Clock extends Date { static now() { return now; } }
  const provider = providerFixture();
  const budgetGlobals = { Date: Clock, process: { env: { GEOCODING_DAILY_LIMIT: dailyLimit } }, globalThis: {} };
  const budgetImports = { "server-only": {}, "node:net": { isIP } };
  const budget = load("lib/address-geocoding-budget.ts", budgetImports, budgetGlobals);
  // Simulate a second Next route bundle evaluating the module independently.
  const paymentBudget = load("lib/address-geocoding-budget.ts", budgetImports, budgetGlobals);
  const route = load("app/api/locations/geocode/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/delivery-address": delivery,
    "@/lib/address-geocoding-budget": budget,
    "@/lib/address-geocoding": { AddressGeocodingError: provider.api.AddressGeocodingError, lookupDeliveryAddress: async (input) => {
      calls.push(input);
      return lookup ? lookup(input) : { status: "matched", location: { latitude: 22.57, longitude: 88.36 }, label: "Delivery address located" };
    } },
  }, { Date: Clock, process: { env: { GEOCODING_DAILY_LIMIT: dailyLimit } } });
  async function post(body = { address }, options = {}) {
    const request = new Request("https://shop.example.test/api/locations/geocode", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://shop.example.test", "x-forwarded-for": "192.0.2.1", ...options.headers },
      body: options.raw ?? JSON.stringify(body),
    });
    const response = await route.POST(request);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    return response;
  }
  function claimPaymentLookup(ip = "192.0.2.1") {
    return paymentBudget.claimAddressGeocodingBudget(new Request("https://shop.example.test/api/razorpay/order", {
      method: "POST", headers: { "x-forwarded-for": ip },
    }));
  }
  return { calls, post, claimPaymentLookup, advance(milliseconds) { now += milliseconds; } };
}

test("guest lookup normalizes only delivery address fields and keeps successful results private", async () => {
  const fixture = routeFixture();
  const response = await fixture.post({ address: { ...address, addressLine1: "  1   Example Road ", name: "PRIVATE NAME", contact: "PRIVATE PHONE" }, apiKey: "PRIVATE KEY", latitude: 0 });
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.calls, [address]);
  assert.equal((await response.json()).status, "matched");
});

test("origin, content type, invalid JSON and bounded bodies are checked before any geocoder call", async () => {
  const fixture = routeFixture();
  for (const [body, options, status] of [
    [{ address }, { headers: { Origin: "https://evil.example.test" } }, 403],
    [{ address }, { headers: { Origin: "" } }, 403],
    [{ address }, { headers: { "Content-Type": "text/plain" } }, 415],
    [{ address }, { headers: { "Content-Type": "application/json-evil" } }, 415],
    [{ address }, { raw: "{" }, 400], [[], {}, 400], [{ address: { ...address, city: "" } }, {}, 400],
    [{ address }, { headers: { "content-length": "4097" } }, 413],
    [{ address, padding: "x".repeat(4096) }, {}, 413],
  ]) {
    const response = await fixture.post(body, options);
    assert.equal(response.status, status);
  }
  assert.equal(fixture.calls.length, 0);
});

test("provider errors and missing credentials are never reflected through the public route", async () => {
  for (const lookup of [() => { throw new Error("PRIVATE credentials/address"); }, () => providerFixture({ key: "" }).api.lookupDeliveryAddress(address)]) {
    const fixture = routeFixture({ lookup });
    const response = await fixture.post();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "GEOCODING_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE|apiKey|Example Road|700001/);
  }
});

test("per-IP budget bounds repeated lookups and resets after a minute", async () => {
  const fixture = routeFixture();
  for (let i = 0; i < 10; i++) assert.equal((await fixture.post()).status, 200);
  assert.equal((await fixture.post()).status, 429);
  assert.equal(fixture.calls.length, 10);
  fixture.advance(60_001);
  assert.equal((await fixture.post()).status, 200);
});

test("global minute budget cannot be bypassed by changing a forwarded IP and daily budget survives minute resets", async () => {
  const fixture = routeFixture();
  for (let i = 0; i < 60; i++) assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": `192.0.2.${i + 1}` } })).status, 200);
  assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": "203.0.113.1" } })).status, 429);
  assert.equal(fixture.calls.length, 60);
  const daily = routeFixture({ dailyLimit: "2" });
  assert.equal((await daily.post()).status, 200);
  daily.advance(60_001);
  assert.equal((await daily.post()).status, 200);
  daily.advance(60_001);
  assert.equal((await daily.post()).status, 429);
  daily.advance(24 * 60 * 60_000);
  assert.equal((await daily.post()).status, 200);
});

test("invalid or missing forwarded addresses share a bounded anonymous bucket", async () => {
  const fixture = routeFixture();
  for (let i = 0; i < 10; i++) assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": `not-an-ip-${i}` } })).status, 200);
  assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": "" } })).status, 429);
});

test("switching from address lookup to payment revalidation cannot bypass the shared per-IP budget", async () => {
  const fixture = routeFixture();
  for (let i = 0; i < 9; i++) assert.equal((await fixture.post()).status, 200);
  fixture.claimPaymentLookup();
  assert.throws(() => fixture.claimPaymentLookup(), { status: 429, code: "GEOCODING_RATE_LIMITED" });
  assert.equal((await fixture.post()).status, 429);
  assert.equal(fixture.calls.length, 9, "Rate-limited requests never reach the provider");
  fixture.advance(60_001);
  fixture.claimPaymentLookup();
  assert.equal((await fixture.post()).status, 200);
});

test("independently loaded route bundles share minute and daily limits even with different IPs", async () => {
  const fixture = routeFixture();
  for (let i = 0; i < 30; i++) {
    assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": `192.0.2.${i + 1}` } })).status, 200);
    fixture.claimPaymentLookup(`203.0.113.${i + 1}`);
  }
  assert.equal((await fixture.post({ address }, { headers: { "x-forwarded-for": "198.51.100.1" } })).status, 429);
  assert.throws(() => fixture.claimPaymentLookup("198.51.100.2"), { status: 429, code: "GEOCODING_RATE_LIMITED" });

  const daily = routeFixture({ dailyLimit: "2" });
  assert.equal((await daily.post()).status, 200);
  daily.claimPaymentLookup("203.0.113.1");
  daily.advance(60_001);
  assert.equal((await daily.post()).status, 429);
  assert.throws(() => daily.claimPaymentLookup("203.0.113.2"), { status: 429, code: "GEOCODING_RATE_LIMITED" });
  daily.advance(24 * 60 * 60_000);
  daily.claimPaymentLookup();
  assert.equal((await daily.post()).status, 200);
});
