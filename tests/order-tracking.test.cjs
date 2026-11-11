const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { test } = require("node:test");
const ts = require("typescript");

function loadModule(filename, imports, env = {}, DateClass = Date) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "Date", outputText)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected test import: ${name}`);
    return imports[name];
  }, module, module.exports, { env }, DateClass);
  return module.exports;
}

const id = "a1000000-0000-4000-8000-000000000001";
const secondId = "a2000000-0000-4000-8000-000000000002";
const owner = "buyer-one";
const token = Buffer.alloc(32, 1).toString("base64url");
const badToken = Buffer.alloc(32, 2).toString("base64url");
const hash = crypto.createHash("sha256").update(token).digest("hex");
const providerData = () => ({ available: true, status: "In transit", courierName: "Example Courier", awb: "AWB123",
  trackingUrl: "https://shiprocket.co/tracking/AWB123", estimatedDeliveryAt: "2026-11-15T12:30:00.000Z", deliveredAt: null,
  events: [{ date: "2026-11-11T10:00:00.000Z", status: "Picked up", location: "Kolkata" }],
});
const row = (overrides = {}) => ({ id, user_id: owner, payment_status: "paid", shipping_address: {
  paymentMode: "live", trackingTokenHash: hash, addressLine1: "PRIVATE ADDRESS", paymentKeyId: "PRIVATE KEY",
  fulfillment: { state: "created", shipmentId: 654, shiprocketOrderId: 321 },
}, ...overrides });

function fixture({ user = { id: owner }, authError = null, rows = [row()], dbError = null, provider = async () => providerData() } = {}) {
  const calls = { auth: 0, adminClients: 0, queries: [], provider: [] };
  let now = Date.parse("2026-11-11T10:00:00.000Z");
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const env = { SHIPROCKET_EMAIL: "test@example.test", SHIPROCKET_PASSWORD: "fake" };
  const client = { auth: { getUser: async () => { calls.auth++; return { data: { user }, error: authError }; } },
    from(table) {
      assert.equal(table, "website_orders");
      const query = { filters: [], columns: "" }; calls.queries.push(query);
      return { select(columns) { query.columns = columns; return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        async maybeSingle() { return { data: rows.find((item) => query.filters.every(([key, value]) => item[key] === value)) || null, error: dbError }; },
      };
    },
  };
  const tokenHelper = loadModule("lib/order-tracking-token.ts", { "server-only": {}, "node:crypto": crypto });
  const service = loadModule("lib/order-tracking.ts", {
    "server-only": {}, "node:crypto": crypto,
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => client },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => { calls.adminClients++; return client; } },
    "@/lib/order-tracking-token": tokenHelper,
    "@/lib/shiprocket": { getShiprocketTracking: async (...args) => { calls.provider.push(args); return provider(...args); } },
  }, env, Clock);
  const next = { NextResponse: { json: (body, options) => Response.json(body, options) } };
  const helper = loadModule("lib/order-tracking-request.ts", { "server-only": {}, "next/server": next, "@/lib/order-tracking": service });
  const imports = { "next/server": next, "@/lib/order-tracking": service, "@/lib/order-tracking-request": helper };
  const accountRoute = loadModule("app/api/account/orders/[id]/tracking/route.ts", imports);
  const guestRoute = loadModule("app/api/orders/tracking/route.ts", imports);
  return { calls, service, env, advance(ms) { now += ms; },
    get: (orderId = id) => accountRoute.GET(new Request(`https://shop.example.test/api/account/orders/${orderId}/tracking`), { params: Promise.resolve({ id: orderId }) }),
    post: (body = { orderId: id, token }, headers = {}) => guestRoute.POST(new Request("https://shop.example.test/api/orders/tracking", {
      method: "POST", headers: { "content-type": "application/json", origin: "https://shop.example.test", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })),
  };
}

test("customer tracking requires verified sign-in before any order/provider access", async () => {
  for (const options of [{ user: null }, { authError: new Error("PRIVATE") }]) {
    const f = fixture(options); const response = await f.get();
    assert.equal(response.status, 401); assert.equal(f.calls.queries.length, 0); assert.equal(f.calls.provider.length, 0);
    assert.doesNotMatch(await response.text(), /PRIVATE/);
  }
});

test("customer tracking is limited to owned orders with RLS client and explicit user filter", async () => {
  const f = fixture({ user: { id: "other-buyer" } });
  assert.equal((await f.get()).status, 404);
  assert.deepEqual(f.calls.queries[0].filters, [["id", id], ["user_id", "other-buyer"]]);
  assert.equal(f.calls.adminClients, 0); assert.equal(f.calls.provider.length, 0);
});

test("owned shipment uses saved IDs, returns only customer tracking, and rechecks ownership on cached requests", async () => {
  const f = fixture(); const response = await f.get(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.tracking.state, "tracking");
  assert.equal(body.tracking.awb, "AWB123"); assert.deepEqual(f.calls.provider, [[654, 321]]);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE|trackingTokenHash|shipmentId|user_id/);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  await f.get(); assert.equal(f.calls.provider.length, 1); assert.equal(f.calls.auth, 2); assert.equal(f.calls.queries.length, 2);
});

test("preparing, payment pending, uncertain fulfillment and test orders never query Shiprocket", async () => {
  for (const [order, state] of [
    [row({ payment_status: "pending" }), "preparing"],
    [row({ shipping_address: { paymentMode: "live" } }), "preparing"],
    [row({ shipping_address: { paymentMode: "live", fulfillment: { state: "needs_review", shipmentId: 654, shiprocketOrderId: 321 } } }), "preparing"],
    [row({ shipping_address: { paymentMode: "test", fulfillment: { state: "created", shipmentId: 654, shiprocketOrderId: 321 } } }), "test_order"],
  ]) {
    const f = fixture({ rows: [order] }); const body = await (await f.get()).json();
    assert.equal(body.tracking.state, state); assert.equal(f.calls.provider.length, 0);
    assert.equal(body.tracking.trackingUrl, null);
  }
});

test("invalid saved shipment IDs and unknown payment mode do not query provider", async () => {
  for (const address of [
    { paymentMode: "live", fulfillment: { state: "created", shipmentId: "654", shiprocketOrderId: 321 } },
    { fulfillment: { state: "created", shipmentId: 654, shiprocketOrderId: 321 } },
  ]) {
    const f = fixture({ rows: [row({ shipping_address: address })] });
    assert.equal((await f.get()).status, 503); assert.equal(f.calls.provider.length, 0);
  }
});

test("private guest token grants tracking without a login but never exposes contact/address/payment data", async () => {
  const f = fixture({ user: null, rows: [row({ user_id: null })] });
  const response = await f.post(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.tracking.status, "In transit");
  assert.equal(f.calls.auth, 0); assert.equal(f.calls.adminClients, 1);
  assert.doesNotMatch(JSON.stringify(body), new RegExp(`PRIVATE|${token}|${hash}`));
});

test("a cached tracking result cannot bypass guest token validation", async () => {
  const f = fixture(); assert.equal((await f.post()).status, 200);
  const rejected = await f.post({ orderId: id, token: badToken });
  assert.equal(rejected.status, 404); assert.equal(f.calls.provider.length, 1); assert.equal(f.calls.queries.length, 2);
});

test("tokens are order-specific; legacy orders and missing references use the same unavailable response", async () => {
  const f = fixture({ rows: [row(), row({ id: secondId, shipping_address: { paymentMode: "live" } })] });
  const legacy = await f.post({ orderId: secondId, token });
  const missing = await f.post({ orderId: "a3000000-0000-4000-8000-000000000003", token });
  const wrong = await f.post({ orderId: id, token: badToken });
  assert.equal(legacy.status, 404); assert.equal(missing.status, 404); assert.equal(wrong.status, 404);
  assert.deepEqual(await legacy.json(), await missing.json());
  assert.equal(f.calls.provider.length, 0);
});

test("malformed guest credentials are rejected before storage lookup", async () => {
  const f = fixture();
  for (const body of [{ orderId: "bad", token }, { orderId: id }, { orderId: id, token: "a" }, { orderId: id, token: [token] }]) {
    assert.equal((await f.post(body)).status, 404);
  }
  assert.equal(f.calls.adminClients, 0); assert.equal(f.calls.provider.length, 0);
});

test("provider errors are sanitized, not cached as pending, and retry can recover", async () => {
  let failing = true;
  const f = fixture({ provider: async () => { if (failing) throw new Error("PRIVATE PROVIDER TOKEN"); return providerData(); } });
  const response = await f.get(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /PRIVATE/);
  failing = false; assert.equal((await f.get()).status, 200); assert.equal(f.calls.provider.length, 2);
});

test("pending courier updates are distinct from preparation; cache expires and credentials isolate results", async () => {
  const f = fixture({ provider: async () => ({ ...providerData(), available: false, status: null, awb: null, events: [] }) });
  const first = await (await f.get()).json(); assert.equal(first.tracking.state, "awaiting_tracking");
  f.advance(59_000); await f.get(); assert.equal(f.calls.provider.length, 1);
  f.advance(1_001); await f.get(); assert.equal(f.calls.provider.length, 2);
  f.env.SHIPROCKET_PASSWORD = "different-fake"; await f.get(); assert.equal(f.calls.provider.length, 3);
});

test("parallel requests share the provider lookup after independent ownership checks", async () => {
  let release; const f = fixture({ provider: () => new Promise((resolve) => { release = resolve; }) });
  const first = f.get(); const second = f.get();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.queries.length, 2); assert.equal(f.calls.provider.length, 1);
  release(providerData()); assert.deepEqual((await Promise.all([first, second])).map((response) => response.status), [200, 200]);
});

test("guest endpoint rejects cross-site requests, wrong content type, bad JSON and oversized streams", async () => {
  const f = fixture();
  assert.equal((await f.post(undefined, { origin: "https://other.example.test" })).status, 403);
  assert.equal((await f.post(undefined, { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await f.post(undefined, { "content-type": "text/plain" })).status, 415);
  assert.equal((await f.post("{" )).status, 400);
  assert.equal((await f.post("[]")).status, 400);
  assert.equal((await f.post("x".repeat(2049))).status, 413);
  assert.equal(f.calls.adminClients, 0);
});

test("storage failures use safe errors without leaking credentials or rows", async () => {
  const f = fixture({ dbError: new Error("PRIVATE DB ERROR") });
  for (const response of [await f.get(), await f.post()]) {
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /PRIVATE/);
  }
  assert.equal(f.calls.provider.length, 0);
});
