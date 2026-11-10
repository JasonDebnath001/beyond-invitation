const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const samplePickup = {
  id: 123,
  pickup_location: "Test Office",
  pin_code: "110001",
  status: 2,
};
const sampleQuote = { deliveryPincode: "400001", weightKg: 0.5 };
const fakeCredentials = {
  SHIPROCKET_EMAIL: "shipping-api@example.test",
  SHIPROCKET_PASSWORD: "private-test-password",
  SHIPROCKET_PICKUP_LOCATION: "Test Office",
};

// Each test gets isolated env, clock and network boundaries. No request can
// escape this mock or reach the seller's real account.
function createClient({ env = {}, onAuth, onPickup, onRates, onCreate, onOrder } = {}) {
  const calls = [];
  let now = 1_800_000_000_000;
  const counts = { auth: 0, pickup: 0, rates: 0, create: 0, order: 0 };
  const fetchStub = async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://apiv2.shiprocket.in");
    const call = { url, options, headers: new Headers(options.headers) };
    calls.push(call);
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    switch (url.pathname) {
      case "/v1/external/auth/login":
        counts.auth++;
        assert.equal(options.method, "POST");
        return onAuth
          ? onAuth(call, counts)
          : Response.json({ token: `private-test-token-${counts.auth}` });
      case "/v1/external/settings/company/pickup":
        counts.pickup++;
        assert.equal(options.method || "GET", "GET");
        return onPickup
          ? onPickup(call, counts)
          : Response.json({ data: { shipping_address: [samplePickup] } });
      case "/v1/external/courier/serviceability/":
        counts.rates++;
        assert.equal(options.method || "GET", "GET");
        return onRates
          ? onRates(call, counts)
          : Response.json({ status: 200, data: { available_courier_companies: [] } });
      case "/v1/external/orders/create/adhoc":
        counts.create++;
        assert.equal(options.method, "POST");
        return onCreate
          ? onCreate(call, counts)
          : Response.json({ order_id: 456, shipment_id: 789, status: "NEW", status_code: 1 });
      case "/v1/external/orders/show/456":
        counts.order++;
        assert.equal(options.method, "GET");
        return onOrder
          ? onOrder(call, counts)
          : Response.json({ data: sampleExistingOrder });
      default:
        assert.fail(`Unexpected endpoint in Shiprocket client: ${url.pathname}`);
    }
  };
  const source = readFileSync(path.join(__dirname, "..", "lib", "shiprocket.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: "shiprocket.ts",
  });
  const module = { exports: {} };
  const imports = { "server-only": {} };
  const clock = class extends Date { static now() { return now; } };
  new Function("require", "module", "exports", "process", "fetch", "Date", outputText)(
    (name) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
      return imports[name];
    },
    module,
    module.exports,
    { env: { ...fakeCredentials, ...env } },
    fetchStub,
    clock,
  );
  return { api: module.exports, calls, counts, advance: (ms) => { now += ms; } };
}

function safeError(api) {
  return (error) => {
    assert.ok(error instanceof api.ShiprocketError);
    assert.equal(typeof error.code, "string");
    assert.ok(error.code.length > 0);
    assert.doesNotMatch(error.message, /private-test|shipping-api@example|UPSTREAM-PRIVATE/);
    return true;
  };
}

test("missing required settings fail locally without exposing configuration values", async () => {
  for (const key of Object.keys(fakeCredentials)) {
    const client = createClient({ env: { [key]: "" } });
    await assert.rejects(client.api.getShiprocketPickupLocation(), safeError(client.api));
    assert.equal(client.calls.length, 0);
  }
});

test("invalid delivery pincodes, weights and dimensions never make API requests", async () => {
  const invalidQuotes = [
    { deliveryPincode: "123" },
    { deliveryPincode: "000001" },
    { deliveryPincode: "40000x" },
    { weightKg: 0 },
    { weightKg: -1 },
    { weightKg: NaN },
    { weightKg: Infinity },
    { lengthCm: 10 },
    { lengthCm: 10, breadthCm: 5, heightCm: 0 },
    { lengthCm: 10, breadthCm: Infinity, heightCm: 5 },
  ];
  for (const invalid of invalidQuotes) {
    const client = createClient();
    await assert.rejects(client.api.getShiprocketRates({ ...sampleQuote, ...invalid }), safeError(client.api));
    assert.equal(client.calls.length, 0);
  }
});

test("the configured pickup nickname must match exactly", async () => {
  const client = createClient({ env: { SHIPROCKET_PICKUP_LOCATION: "test office" } });
  await assert.rejects(client.api.getShiprocketPickupLocation(), safeError(client.api));
  assert.equal(client.counts.rates, 0);
});

test("only the selected pickup's name, ID and pincode leave the client", async () => {
  const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [
    { ...samplePickup, email: "private-test@example.test", address: "private-test-street", phone: "9999999999" },
  ] } }) });
  assert.deepEqual(await client.api.getShiprocketPickupLocation(), {
    id: 123, name: "Test Office", pincode: "110001",
  });
});

test("rates use the saved pickup and normalize the courier response", async () => {
  const client = createClient({ onRates: (call) => {
    assert.equal(call.url.searchParams.get("pickup_postcode"), "110001");
    assert.equal(call.url.searchParams.get("delivery_postcode"), "400001");
    assert.equal(call.url.searchParams.get("weight"), "0.5");
    assert.equal(call.url.searchParams.get("cod"), "1");
    assert.equal(call.url.searchParams.get("length"), "20");
    assert.equal(call.url.searchParams.get("breadth"), "10");
    assert.equal(call.url.searchParams.get("height"), "5");
    return Response.json({ status: 200, data: { available_courier_companies: [
      { courier_company_id: 17, courier_name: "Test Courier", rate: "77.50", estimated_delivery_days: "3" },
    ] } });
  } });
  const result = await client.api.getShiprocketRates({ ...sampleQuote, cod: true, lengthCm: 20, breadthCm: 10, heightCm: 5 });
  assert.deepEqual(result, {
    pickupLocation: { id: 123, name: "Test Office", pincode: "110001" },
    deliveryPincode: "400001",
    weightKg: 0.5,
    cod: true,
    currency: "INR",
    couriers: [{ id: 17, name: "Test Courier", rate: 77.5, estimatedDeliveryDays: 3 }],
  });
  for (const call of client.calls.filter((item) => !item.url.pathname.endsWith("/auth/login"))) {
    assert.equal(call.headers.get("authorization"), "Bearer private-test-token-1");
  }
});

test("an empty successful serviceability response means no available couriers", async () => {
  const client = createClient();
  const result = await client.api.getShiprocketRates(sampleQuote);
  assert.deepEqual(result.couriers, []);
  assert.equal(result.cod, false);
  const call = client.calls.find((item) => item.url.pathname.endsWith("/serviceability/"));
  assert.equal(call.url.searchParams.get("cod"), "0");
});

test("the token is reused and refreshed after its lifetime", async () => {
  const client = createClient();
  await client.api.getShiprocketPickupLocation();
  await client.api.getShiprocketPickupLocation();
  assert.equal(client.counts.auth, 1);
  client.advance(10 * 24 * 60 * 60 * 1000);
  await client.api.getShiprocketPickupLocation();
  assert.equal(client.counts.auth, 2);
});

test("concurrent calls share one pending login", async () => {
  let completeLogin;
  const client = createClient({ onAuth: () => new Promise((resolve) => { completeLogin = resolve; }) });
  const first = client.api.getShiprocketPickupLocation();
  const second = client.api.getShiprocketPickupLocation();
  await new Promise(setImmediate);
  assert.equal(client.counts.auth, 1);
  completeLogin(Response.json({ token: "private-test-token-shared" }));
  await Promise.all([first, second]);
  assert.equal(client.counts.auth, 1);
});

test("a 401 triggers one new login and retries with the new token", async () => {
  const client = createClient({ onPickup: (call, counts) => {
    if (counts.pickup === 1) return Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 401 });
    assert.equal(call.headers.get("authorization"), "Bearer private-test-token-2");
    return Response.json({ data: { shipping_address: [samplePickup] } });
  } });
  assert.equal((await client.api.getShiprocketPickupLocation()).id, 123);
  assert.equal(client.counts.auth, 2);
  assert.equal(client.counts.pickup, 2);
});

test("repeated unauthorized responses stop after one refresh", async () => {
  const client = createClient({ onPickup: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 401 }) });
  await assert.rejects(client.api.getShiprocketPickupLocation(), safeError(client.api));
  assert.equal(client.counts.auth, 2);
  assert.equal(client.counts.pickup, 2);
});

test("authentication, transport and invalid-response failures keep upstream details private", async () => {
  const cases = [
    { onAuth: () => Response.json({ message: "UPSTREAM-PRIVATE private-test-password" }, { status: 401 }) },
    { onAuth: () => { throw new Error("UPSTREAM-PRIVATE private-test-password"); } },
    { onAuth: () => new Response("UPSTREAM-PRIVATE private-test-password", { status: 200 }) },
    { onAuth: () => Response.json({ message: "UPSTREAM-PRIVATE", token: "" }) },
    { onPickup: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 403 }) },
  ];
  for (const options of cases) {
    const client = createClient(options);
    await assert.rejects(client.api.getShiprocketPickupLocation(), safeError(client.api));
  }
});

test("provider failures are not silently reported as unavailable couriers", async () => {
  for (const response of [
    () => Response.json({ status: 400, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status: 200, data: {} }),
    () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 422 }),
  ]) {
    const client = createClient({ onRates: response });
    await assert.rejects(client.api.getShiprocketRates(sampleQuote), safeError(client.api));
  }
});

const sampleOrder = {
  order_id: "24197857161011715162171839636988778104",
  order_date: "2026-11-10 12:30",
  pickup_location: "Test Office",
  billing_customer_name: "Test Buyer",
  billing_address: "12 Test Street",
  billing_city: "New Delhi",
  billing_pincode: "110001",
  billing_state: "Delhi",
  billing_country: "India",
  billing_email: "buyer@example.test",
  billing_phone: "9999999999",
  shipping_is_billing: true,
  order_items: [{ name: "Invitation", sku: "INV-1", units: 2, selling_price: 75 }],
  payment_method: "Prepaid",
  sub_total: 150,
  length: 20,
  breadth: 10,
  height: 5,
  weight: 0.5,
};

const sampleExistingOrder = {
  id: 456,
  channel_order_id: sampleOrder.order_id,
  total: "150.00",
  delivery_code: "110001",
  customer_pincode: "110001",
  currency: "INR",
  status: "NEW",
  status_code: 1,
  shipments: { id: 789, order_id: 456, status: "PENDING" },
};

function createError(api, outcome, code) {
  return (error) => {
    safeError(api)(error);
    assert.ok(error instanceof api.ShiprocketOrderError);
    assert.equal(error.outcome, outcome);
    if (code) assert.equal(error.code, code);
    return true;
  };
}

test("order creation sends the stable reference and complete package once, without courier booking", async () => {
  const client = createClient({ onCreate: (call) => {
    assert.equal(call.headers.get("authorization"), "Bearer private-test-token-1");
    assert.equal(call.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(call.options.body), sampleOrder);
    return Response.json({ order_id: "456", shipment_id: "789", status: "NEW", status_code: 1, message: "UPSTREAM-PRIVATE" });
  } });
  assert.deepEqual(await client.api.createShiprocketOrder(sampleOrder), { orderId: 456, shipmentId: 789, status: "NEW" });
  assert.equal(client.counts.create, 1);
  assert.deepEqual(client.calls.map((call) => call.url.pathname), [
    "/v1/external/auth/login", "/v1/external/orders/create/adhoc",
  ]);
});

test("invalid creation payloads are rejected before authentication or mutation", async () => {
  const invalidInputs = [
    null,
    { order_id: "" },
    { order_id: "1".repeat(51) },
    { order_date: "2026-02-30" },
    { order_date: "2026-11-10 25:00" },
    { billing_email: "invalid" },
    { billing_phone: "123" },
    { billing_pincode: "000001" },
    { billing_country: "USA" },
    { shipping_is_billing: false },
    { sub_total: NaN },
    { length: 0.5 },
    { breadth: Infinity },
    { height: 0 },
    { weight: -1 },
    { order_items: [] },
    { order_items: [{ ...sampleOrder.order_items[0], units: 1.5 }] },
    { order_items: [{ ...sampleOrder.order_items[0], selling_price: -1 }] },
    { payment_method: "unpaid" },
    { shipping_charges: -1 },
    { pickup_location: "Other Office" },
  ];
  for (const invalid of invalidInputs) {
    const client = createClient();
    await assert.rejects(client.api.createShiprocketOrder(invalid === null ? null : { ...sampleOrder, ...invalid }), createError(client.api, "rejected", "INVALID_INPUT"));
    assert.equal(client.calls.length, 0);
  }
});

test("pre-create authentication failures are definite rejections and send no create request", async () => {
  for (const onAuth of [
    () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 401 }),
    () => { throw new Error("UPSTREAM-PRIVATE private-test-password"); },
  ]) {
    const client = createClient({ onAuth });
    await assert.rejects(client.api.createShiprocketOrder(sampleOrder), createError(client.api, "rejected"));
    assert.equal(client.counts.create, 0);
  }
});

test("explicit validation or permission rejections are sanitized and never automatically retried", async () => {
  const responses = [
    ...[400, 401, 403, 404, 405, 422, 429].map((status) => () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status })),
    () => Response.json({ status_code: 422, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ success: false, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status: false, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status: "error", message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ errors: { billing_email: ["UPSTREAM-PRIVATE"] } }),
  ];
  for (const onCreate of responses) {
    const client = createClient({ onCreate });
    await assert.rejects(client.api.createShiprocketOrder(sampleOrder), createError(client.api, "rejected", "ORDER_REJECTED"));
    assert.equal(client.counts.create, 1);
    assert.equal(client.counts.auth, 1);
  }
});

test("ambiguous creation outcomes require reconciliation and are never automatically retried", async () => {
  const responses = [
    () => { throw new Error("UPSTREAM-PRIVATE private-test-token-1"); },
    () => { throw new DOMException("UPSTREAM-PRIVATE", "TimeoutError"); },
    ...[408, 500, 502, 503, 504].map((status) => () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status })),
    () => Response.json({ status_code: 500, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status_code: 408, message: "UPSTREAM-PRIVATE" }),
    () => new Response("UPSTREAM-PRIVATE", { status: 200 }),
    () => Response.json({ order_id: 456 }),
    () => Response.json({ order_id: 456, shipment_id: 0 }),
    () => Response.json({ order_id: Number.MAX_SAFE_INTEGER + 1, shipment_id: 789 }),
    () => Response.json({ success: true, data: {} }),
    () => Response.json({ success: false, order_id: 456, shipment_id: 789 }),
  ];
  for (const onCreate of responses) {
    const client = createClient({ onCreate });
    await assert.rejects(client.api.createShiprocketOrder(sampleOrder), createError(client.api, "unknown", "ORDER_OUTCOME_UNKNOWN"));
    assert.equal(client.counts.create, 1);
  }
});

test("duplicate merchant references require linking the existing order instead of resubmitting", async () => {
  for (const onCreate of [
    () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 409 }),
    () => Response.json({ message: "Duplicate order_id UPSTREAM-PRIVATE" }, { status: 422 }),
    () => Response.json({ errors: { order_id: ["The order id has already been taken. UPSTREAM-PRIVATE"] } }, { status: 422 }),
    () => Response.json({ status: false, message: "Order already exists. UPSTREAM-PRIVATE" }),
  ]) {
    const client = createClient({ onCreate });
    await assert.rejects(client.api.createShiprocketOrder(sampleOrder), createError(client.api, "unknown", "ORDER_DUPLICATE"));
    assert.equal(client.counts.create, 1);
  }
});

test("creation returns only known status labels and identifiers", async () => {
  const client = createClient({ onCreate: () => Response.json({ order_id: 456, shipment_id: 789, status: "UPSTREAM-PRIVATE" }) });
  assert.deepEqual(await client.api.createShiprocketOrder(sampleOrder), { orderId: 456, shipmentId: 789 });
});

test("order reconciliation reads one exact matching shipment and returns only verification fields", async () => {
  for (const shipments of [sampleExistingOrder.shipments, [sampleExistingOrder.shipments]]) {
    const client = createClient({ onOrder: () => Response.json({ data: {
      ...sampleExistingOrder, shipments, customer_email: "UPSTREAM-PRIVATE", customer_address: "UPSTREAM-PRIVATE",
    } }) });
    assert.deepEqual(await client.api.getShiprocketOrder(456), {
      orderId: 456, shipmentId: 789, merchantOrderId: sampleOrder.order_id, total: 150, deliveryPincode: "110001", status: "NEW",
    });
    assert.equal(client.counts.create, 0);
    assert.equal(client.counts.order, 1);
  }
});

test("reconciliation rejects missing, mismatched, or ambiguous order details", async () => {
  const invalidOrders = [
    { id: 457 },
    { channel_order_id: "" },
    { total: null },
    { total: -1 },
    { currency: "USD" },
    { delivery_code: "invalid", customer_pincode: "invalid" },
    { shipments: [] },
    { shipments: { id: 789, order_id: 457 } },
    { shipments: [{ id: 789, order_id: 456 }, { id: 790, order_id: 456 }] },
  ];
  for (const invalid of invalidOrders) {
    const client = createClient({ onOrder: () => Response.json({ data: { ...sampleExistingOrder, ...invalid } }) });
    await assert.rejects(client.api.getShiprocketOrder(456), safeError(client.api));
    assert.equal(client.counts.create, 0);
  }
});

test("cancelled or cancelling orders and shipments cannot be reconciled as successful creation", async () => {
  for (const cancelled of [
    { status_code: 5 }, { status_code: 18 }, { status_code: 54 },
    { status: "CANCELLED" }, { status: "CANCELLATION REQUESTED" },
    { shipments: { ...sampleExistingOrder.shipments, status: "CANCELED" } },
    { shipments: { ...sampleExistingOrder.shipments, status_code: 8 } },
    { shipments: { ...sampleExistingOrder.shipments, status_code: 16 } },
    { shipments: { ...sampleExistingOrder.shipments, status_code: 45 } },
  ]) {
    const client = createClient({ onOrder: () => Response.json({ data: { ...sampleExistingOrder, ...cancelled } }) });
    await assert.rejects(client.api.getShiprocketOrder(456), (error) => {
      safeError(client.api)(error);
      assert.equal(error.code, "ORDER_CANCELLED");
      return true;
    });
  }
});
