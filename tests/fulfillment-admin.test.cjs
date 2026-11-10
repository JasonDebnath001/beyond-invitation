const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const adminId = "a1000000-0000-4000-8000-000000000001";
const orderId = "b2000000-0000-4000-8000-000000000002";
const shipmentPackage = {
  weightKg: 2,
  lengthCm: 20,
  breadthCm: 15,
  heightCm: 10,
};
const orderView = {
  id: orderId,
  fulfillment: { state: "created", shiprocketOrderId: 321, shipmentId: 654 },
};

function loadModule(filename, imports = {}, env = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", filename), "utf8"),
    {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "process", outputText)(
    (name) => {
      if (!Object.hasOwn(imports, name))
        throw new Error(`Unexpected test import: ${name}`);
      return imports[name];
    },
    loaded,
    loaded.exports,
    { env },
  );
  return loaded.exports;
}

function createFixture({
  user = { id: adminId, app_metadata: { role: "admin" } },
  authError = null,
  authUnavailable = false,
  allowedIds = "",
  serviceError,
} = {}) {
  const calls = { authClient: 0, auth: 0, list: [], create: [], reconcile: [] };
  const auth = loadModule(
    "lib/admin-auth.ts",
    {
      "server-only": {},
      "@/lib/supabase/auth-server": {
        getSupabaseAuthServerClient: async () => {
          calls.authClient++;
          if (authUnavailable)
            throw new Error("PRIVATE auth service unavailable");
          return {
            auth: {
              getUser: async () => {
                calls.auth++;
                return { data: { user }, error: authError };
              },
            },
          };
        },
      },
    },
    { ADMIN_USER_IDS: allowedIds },
  );
  class FulfillmentError extends Error {
    constructor(code, message, status) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  const service = {
    FulfillmentError,
    listFulfillmentOrders: async (input) => {
      calls.list.push(input);
      if (serviceError) throw serviceError;
      return [orderView];
    },
    createOrderShipment: async (...args) => {
      calls.create.push(args);
      if (serviceError) throw serviceError;
      return orderView;
    },
    reconcileOrderShipment: async (...args) => {
      calls.reconcile.push(args);
      if (serviceError) throw serviceError;
      return orderView;
    },
  };
  const next = {
    NextResponse: { json: (body, options) => Response.json(body, options) },
  };
  const helper = loadModule("lib/admin/order-request.ts", {
    "server-only": {},
    "next/server": next,
    "@/lib/admin-auth": auth,
    "@/lib/order-fulfillment": service,
  });
  const imports = {
    "next/server": next,
    "@/lib/admin-auth": auth,
    "@/lib/order-fulfillment": service,
    "@/lib/admin/order-request": helper,
  };
  const list = loadModule("app/api/admin/orders/route.ts", imports);
  const create = loadModule(
    "app/api/admin/orders/[id]/shipping/route.ts",
    imports,
  );
  const reconcile = loadModule(
    "app/api/admin/orders/[id]/reconcile/route.ts",
    imports,
  );
  const get = (query = "") => {
    const request = new Request(
      `https://shop.example.test/api/admin/orders${query}`,
    );
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    return list.GET(request);
  };
  const post = (
    kind,
    body = { package: shipmentPackage },
    {
      id = orderId,
      origin = "https://shop.example.test",
      contentType = "application/json",
      raw,
      contentLength,
    } = {},
  ) => {
    const headers = new Headers();
    if (origin !== null) headers.set("Origin", origin);
    if (contentType !== null) headers.set("Content-Type", contentType);
    if (contentLength !== undefined)
      headers.set("Content-Length", String(contentLength));
    const request = new Request(
      `https://shop.example.test/api/admin/orders/${id}/${kind}`,
      {
        method: "POST",
        headers,
        body: raw ?? JSON.stringify(body),
      },
    );
    return (kind === "shipping" ? create : reconcile).POST(request, {
      params: Promise.resolve({ id }),
    });
  };
  return { calls, auth, service, helper, get, post };
}

async function expectStatus(responsePromise, status) {
  const response = await responsePromise;
  assert.equal(response.status, status);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  return response;
}

test("any visitor can list orders without calling the authentication service", async () => {
  for (const options of [
    { user: null },
    { authError: { message: "expired session" } },
    { authUnavailable: true },
    { user: { id: adminId, app_metadata: { role: "customer" } } },
  ]) {
    const fixture = createFixture(options);
    const response = await expectStatus(fixture.get(), 200);
    assert.deepEqual(await response.json(), { orders: [orderView] });
    assert.deepEqual(fixture.calls.list, [{ limit: 50, before: undefined }]);
    assert.equal(fixture.calls.authClient, 0);
    assert.equal(fixture.calls.auth, 0);
    assert.deepEqual(fixture.calls.create, []);
    assert.deepEqual(fixture.calls.reconcile, []);
  }
});

test("shipment changes still require a verified signed-in staff user", async () => {
  for (const options of [
    { user: null },
    { authError: { message: "expired session" } },
  ]) {
    const fixture = createFixture(options);
    await expectStatus(fixture.post("shipping"), 401);
    await expectStatus(
      fixture.post("reconcile", { shiprocketOrderId: 123 }),
      401,
    );
    assert.deepEqual(fixture.calls.list, []);
    assert.deepEqual(fixture.calls.create, []);
    assert.deepEqual(fixture.calls.reconcile, []);
  }
});

test("customer-controlled metadata and email addresses cannot grant admin privileges", async () => {
  for (const options of [
    {
      user: {
        id: adminId,
        email: "owner@example.test",
        user_metadata: { role: "admin" },
      },
    },
    { user: { id: adminId }, allowedIds: "*,owner@example.test" },
    {
      user: { id: adminId, app_metadata: { role: "customer" } },
      allowedIds: orderId,
    },
  ]) {
    const fixture = createFixture(options);
    await expectStatus(fixture.post("shipping"), 403);
    await expectStatus(
      fixture.post("reconcile", { shiprocketOrderId: 321 }),
      403,
    );
    assert.deepEqual(fixture.calls.list, []);
    assert.deepEqual(fixture.calls.create, []);
    assert.deepEqual(fixture.calls.reconcile, []);
  }
});

test("server-managed roles or explicit UUID allowlists grant shipment management access", async () => {
  for (const options of [
    {},
    {
      user: { id: adminId },
      allowedIds: ` ${orderId}, ${adminId.toUpperCase()} `,
    },
  ]) {
    const fixture = createFixture(options);
    assert.deepEqual(await fixture.auth.getFulfillmentAdmin(), { id: adminId });
    await expectStatus(fixture.post("shipping"), 200);
    await expectStatus(
      fixture.post("reconcile", { shiprocketOrderId: 321 }),
      200,
    );
    assert.deepEqual(fixture.calls.create, [[orderId, shipmentPackage]]);
    assert.deepEqual(fixture.calls.reconcile, [[orderId, 321]]);
  }
});

test("order listing validates pagination before accessing order storage", async () => {
  for (const query of [
    "?limit=0",
    "?limit=101",
    "?limit=1.5",
    "?limit=bad",
    "?before=not-a-date",
  ]) {
    const fixture = createFixture({ user: null, authUnavailable: true });
    await expectStatus(fixture.get(query), 400);
    assert.deepEqual(fixture.calls.list, []);
    assert.equal(fixture.calls.authClient, 0);
  }
  const fixture = createFixture({ user: null });
  const response = await expectStatus(
    fixture.get("?limit=25&before=2026-11-10T00%3A00%3A00Z"),
    200,
  );
  assert.deepEqual(await response.json(), { orders: [orderView] });
  assert.deepEqual(fixture.calls.list, [
    { limit: 25, before: "2026-11-10T00:00:00Z" },
  ]);
  assert.equal(fixture.calls.authClient, 0);
});

test("shipment writes require the exact same origin, including rejecting a missing Origin", async () => {
  for (const kind of ["shipping", "reconcile"]) {
    for (const origin of [
      null,
      "https://attacker.example.test",
      "http://shop.example.test",
      "null",
    ]) {
      const fixture = createFixture();
      await expectStatus(fixture.post(kind, {}, { origin }), 403);
      assert.deepEqual(fixture.calls.create, []);
      assert.deepEqual(fixture.calls.reconcile, []);
    }
  }
});

test("staff commands reject malformed IDs, content types and JSON bodies", async () => {
  for (const [options, status] of [
    [{ id: "not-an-order" }, 400],
    [{ contentType: "text/plain" }, 415],
    [{ raw: "{not-json" }, 400],
    [{ raw: "[]" }, 400],
    [{ raw: "null" }, 400],
  ]) {
    const fixture = createFixture();
    await expectStatus(fixture.post("shipping", {}, options), status);
    assert.deepEqual(fixture.calls.create, []);
  }
});

test("oversized staff commands are bounded even without a Content-Length header", async () => {
  for (const options of [
    { contentLength: 9000 },
    { raw: JSON.stringify({ notes: "x".repeat(9000) }) },
  ]) {
    const fixture = createFixture();
    await expectStatus(fixture.post("shipping", {}, options), 413);
    assert.deepEqual(fixture.calls.create, []);
  }
});

test("shipment creation forwards only its saved order ID and package measurements", async () => {
  const fixture = createFixture();
  const response = await expectStatus(
    fixture.post("shipping", {
      package: shipmentPackage,
      amountPaise: 1,
      paymentMode: "live",
      paymentStatus: "paid",
      customer: { email: "attacker@example.test" },
      shiprocketOrderId: 999,
    }),
    200,
  );
  assert.deepEqual(fixture.calls.create, [[orderId, shipmentPackage]]);
  assert.deepEqual(await response.json(), { order: orderView });
});

test("reconciliation forwards a provider order ID without invoking creation", async () => {
  const fixture = createFixture();
  const response = await expectStatus(
    fixture.post("reconcile", {
      shiprocketOrderId: 321,
      package: shipmentPackage,
    }),
    200,
  );
  assert.deepEqual(fixture.calls.reconcile, [[orderId, 321]]);
  assert.deepEqual(fixture.calls.create, []);
  assert.deepEqual(await response.json(), { order: orderView });
});

test("unexpected provider/storage errors never leak credentials or raw payloads", async () => {
  const fixture = createFixture({
    serviceError: new Error(
      "PRIVATE database response with provider-token-secret",
    ),
  });
  for (const request of [
    fixture.get(),
    fixture.post("shipping"),
    fixture.post("reconcile", { shiprocketOrderId: 321 }),
  ]) {
    const response = await expectStatus(request, 503);
    assert.doesNotMatch(await response.text(), /PRIVATE|provider-token-secret/);
  }
});

test("known fulfillment errors retain their safe code and status", async () => {
  const fixture = createFixture();
  const response = fixture.helper.adminOrdersError(
    new fixture.service.FulfillmentError(
      "PAYMENT_NOT_LIVE",
      "Only live paid orders can be shipped.",
      409,
    ),
  );
  await expectStatus(Promise.resolve(response), 409);
  assert.deepEqual(await response.json(), {
    code: "PAYMENT_NOT_LIVE",
    error: "Only live paid orders can be shipped.",
  });
});
