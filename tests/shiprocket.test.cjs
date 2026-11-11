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
const quickPickup = { ...samplePickup, lat: "28.509223937988", long: "77.067848205566" };
const quickQuote = { deliveryPincode: "110002", deliveryLocation: { latitude: 28.50724220275879, longitude: 77.06745147705078 }, weightKg: 2 };
const fakeCredentials = {
  SHIPROCKET_EMAIL: "shipping-api@example.test",
  SHIPROCKET_PASSWORD: "private-test-password",
  SHIPROCKET_PICKUP_LOCATION: "Test Office",
};

// Each test gets isolated env, clock and network boundaries. No request can
// escape this mock or reach the seller's real account.
function createClient({ env = {}, onAuth, onPickup, onRates, onCreate, onOrder, onTracking, onCouriers, onAssign } = {}) {
  const calls = [];
  let now = 1_800_000_000_000;
  const counts = { auth: 0, pickup: 0, rates: 0, create: 0, order: 0, tracking: 0, couriers: 0, assign: 0 };
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
      case "/v1/external/courier/track/shipment/789":
        counts.tracking++;
        assert.equal(options.method, "GET");
        return onTracking ? onTracking(call, counts) : Response.json(sampleTracking);
      case "/v1/external/courier/courierListWithCounts":
        counts.couriers++;
        assert.equal(options.method, "GET");
        return onCouriers ? onCouriers(call, counts) : Response.json({ courier_data: [
          { id: 9001, name: "Quick Test 2W", is_hyperlocal: 1 },
          { id: 42, name: "Standard Test", is_hyperlocal: 0 },
        ] });
      case "/v1/external/courier/assign/awb":
        counts.assign++;
        assert.equal(options.method, "POST");
        return onAssign ? onAssign(call, counts) : Response.json({ success: true });
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

test("Quick pickup reads exact saved coordinates and exposes no address/contact data", async () => {
  const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [
    { ...quickPickup, address: "UPSTREAM-PRIVATE", phone: "9999999999", email: "private-test@example.test" },
    { ...quickPickup, id: 124, pickup_location: "Another warehouse", lat: 19.01, long: 72.01 },
  ] } }) });
  assert.deepEqual(await client.api.getShiprocketQuickPickupLocation(), {
    id: 123, name: "Test Office", pincode: "110001", latitude: 28.509223937988, longitude: 77.067848205566,
  });
  assert.equal(client.counts.rates, 0);
});

test("Quick quotes reject invalid pincode, weight, coordinates or COD before network access", async () => {
  const inputs = [null, {}, { ...quickQuote, deliveryPincode: "000001" },
    ...[0, -1, Infinity, NaN, "2", 1000.01].map((weightKg) => ({ ...quickQuote, weightKg })),
    ...[null, {}, { latitude: "28.5", longitude: 77 }, { latitude: 28.5, longitude: "77" },
      { latitude: 91, longitude: 77 }, { latitude: -91, longitude: 77 },
      { latitude: 28, longitude: 181 }, { latitude: 28, longitude: -181 },
      { latitude: NaN, longitude: 77 }, { latitude: 28, longitude: Infinity },
    ].map((deliveryLocation) => ({ ...quickQuote, deliveryLocation })),
    { ...quickQuote, cod: 1 },
  ];
  for (const input of inputs) {
    const client = createClient();
    await assert.rejects(client.api.getShiprocketQuickRates(input), (error) => {
      assert.equal(error.code, "INVALID_INPUT"); return safeError(client.api)(error);
    });
    assert.equal(client.calls.length, 0);
  }
});

test("Quick does not substitute zero or pincode coordinates for missing/invalid saved pickup coordinates", async () => {
  for (const point of [{}, { lat: null, long: 77 }, { lat: "", long: 77 }, { lat: " ", long: 77 },
    { lat: true, long: 77 }, { lat: [], long: 77 }, { lat: "0x1", long: 77 }, { lat: 28, long: undefined },
    { lat: 91, long: 77 }, { lat: 28, long: -181 }]) {
    const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [{ ...samplePickup, ...point }] } }) });
    await assert.rejects(client.api.getShiprocketQuickRates(quickQuote), (error) => {
      assert.equal(error.code, "QUICK_PICKUP_LOCATION_MISSING"); return safeError(client.api)(error);
    });
    assert.equal(client.counts.rates, 0);
  }
});

test("Quick uses documented geographic serviceability parameters and does not invent courier IDs", async () => {
  const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [quickPickup] } }),
    onRates: (call) => {
      assert.deepEqual(Object.fromEntries(call.url.searchParams), {
        pickup_postcode: "110001", delivery_postcode: "110002", weight: "2", cod: "1", is_new_hyperlocal: "1",
        lat_from: "28.509223937988", long_from: "77.067848205566", lat_to: "28.50724220275879", long_to: "77.06745147705078",
      });
      return Response.json({ status: true, data: [{ courier_name: "Shiprocket Quick", rates: "345.3", private: "UPSTREAM-PRIVATE" }] });
    },
  });
  const result = await client.api.getShiprocketQuickRates({ ...quickQuote, cod: true });
  assert.deepEqual(result, {
    pickupLocation: { id: 123, name: "Test Office", pincode: "110001", latitude: 28.509223937988, longitude: 77.067848205566 },
    ...quickQuote, cod: true, currency: "INR", couriers: [{ name: "Shiprocket Quick", rate: 345.3 }],
  });
  assert.equal(client.calls.filter((call) => call.options.method === "POST").length, 1, "Only authentication may POST");
  assert.equal(client.counts.create, 0);
  assert.doesNotMatch(JSON.stringify(result), /UPSTREAM-PRIVATE|courierId|estimatedDelivery/);
});

test("Quick accepts an empty successful rate list and preserves explicit numeric zero coordinates", async () => {
  const client = createClient({
    onPickup: () => Response.json({ data: { shipping_address: [{ ...samplePickup, lat: "0", long: 0 }] } }),
    onRates: () => Response.json({ status: true, data: [] }),
  });
  const result = await client.api.getShiprocketQuickRates({ ...quickQuote, deliveryLocation: { latitude: 0, longitude: 0 } });
  assert.deepEqual(result.couriers, []);
  assert.equal(result.cod, false);
  assert.equal(result.pickupLocation.latitude, 0);
  assert.equal(result.deliveryLocation.longitude, 0);
});

test("Quick rejects ordinary courier responses, malformed shapes and failed payloads", async () => {
  const badResponses = [
    { status: 200, data: { available_courier_companies: [] } },
    { data: [] }, { status: true, data: null }, { status: false, data: [] },
    { status: true, error: "UPSTREAM-PRIVATE", data: [] },
    { status: true, errors: ["UPSTREAM-PRIVATE"], data: [] },
    { status: true, currency: "USD", data: [] },
    { status: true, data: Array.from({ length: 101 }, () => ({ courier_name: "Quick", rates: "10" })) },
    ...[null, {}, { courier_name: "Quick", rate: 345.3 }, { courier_name: "", rates: "345.3" },
      { courier_name: "x".repeat(161), rates: "345.3" }, { courier_name: "Quick\u0000bad", rates: "345.3" },
      ...[-1, null, true, "", "0x10", "NaN", "Infinity", 21_474_836.48].map((rates) => ({ courier_name: "Quick", rates })),
    ].map((value) => ({ status: true, data: [value] })),
  ];
  for (const body of badResponses) {
    const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [quickPickup] } }), onRates: () => Response.json(body) });
    await assert.rejects(client.api.getShiprocketQuickRates(quickQuote), safeError(client.api));
  }
});

test("Quick provider failures remain safe and never mutate shipments", async () => {
  for (const status of [403, 404, 429, 500]) {
    const client = createClient({ onPickup: () => Response.json({ data: { shipping_address: [quickPickup] } }),
      onRates: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status }),
    });
    await assert.rejects(client.api.getShiprocketQuickRates(quickQuote), (error) => {
      assert.equal(error.httpStatus, status); return safeError(client.api)(error);
    });
    assert.equal(client.counts.create, 0);
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

test("Quick order creation sends the exact delivery point and HL shipping method", async () => {
  for (const point of [{ latitude: 28.50724, longitude: 77.06745 }, { latitude: 0, longitude: 0 }]) {
    const payload = { ...sampleOrder, ...point, shipping_method: "HL" };
    const client = createClient({ onCreate: (call) => {
      assert.deepEqual(JSON.parse(call.options.body), payload);
      return Response.json({ order_id: 456, shipment_id: 789 });
    } });
    await client.api.createShiprocketOrder(payload);
    assert.equal(client.counts.create, 1);
    assert.equal(client.counts.assign, 0);
  }
});

test("Quick coordinates must be a complete numeric pair and HL requires that pair before auth", async () => {
  for (const patch of [{ latitude: 28 }, { longitude: 77 }, { latitude: "28", longitude: 77 },
    { latitude: 28, longitude: "77" }, { latitude: null, longitude: null },
    { latitude: 91, longitude: 77 }, { latitude: 28, longitude: 181 },
    { latitude: NaN, longitude: 77 }, { latitude: 28, longitude: Infinity },
    { shipping_method: "HL" }, { shipping_method: "SR_QUICK", latitude: 28, longitude: 77 }]) {
    const client = createClient();
    await assert.rejects(client.api.createShiprocketOrder({ ...sampleOrder, ...patch }), createError(client.api, "rejected", "INVALID_INPUT"));
    assert.equal(client.calls.length, 0);
  }
});

test("Quick courier catalog uses explicit hyperlocal flags and returns only current IDs and names", async () => {
  const client = createClient({ onCouriers: (call) => {
    assert.equal(call.headers.get("authorization"), "Bearer private-test-token-1");
    assert.equal(call.url.search, "");
    return Response.json({ courier_data: [
      { id: "9003", name: "Quick C", is_hyperlocal: "1", phone: "UPSTREAM-PRIVATE" },
      { id: 9001, name: "Quick A", is_hyperlocal: true },
      { id: 9002, name: "Quick B", is_hyperlocal: 1 },
      ...[false, 0, "0", "true", undefined, null].map((is_hyperlocal, index) => ({ id: index + 100, name: "Quick in name only", is_hyperlocal })),
    ] });
  } });
  assert.deepEqual(await client.api.getShiprocketQuickCouriers(), [
    { id: 9001, name: "Quick A" }, { id: 9002, name: "Quick B" }, { id: 9003, name: "Quick C" },
  ]);
  assert.equal(client.counts.assign, 0);
});

test("Quick courier catalog rejects malformed candidates without sending a booking", async () => {
  for (const body of [{}, { courier_data: {} }, { courier_data: [null] },
    { courier_data: [{ id: 0, name: "Quick", is_hyperlocal: 1 }] },
    { courier_data: [{ id: Number.MAX_SAFE_INTEGER + 1, name: "Quick", is_hyperlocal: 1 }] },
    { courier_data: [{ id: 9001, name: "Quick\n", is_hyperlocal: 1 }] },
    { courier_data: [{ id: 9001, name: "", is_hyperlocal: 1 }] },
    { courier_data: [{ id: 9001, name: "Quick", is_hyperlocal: 1 }, { id: 9001, name: "Another", is_hyperlocal: 1 }] },
    { courier_data: [], errors: { permission: "UPSTREAM-PRIVATE" } }]) {
    const client = createClient({ onCouriers: () => Response.json(body) });
    await assert.rejects(client.api.getShiprocketQuickCouriers(), safeError(client.api));
    assert.equal(client.counts.assign, 0);
  }
  const empty = createClient({ onCouriers: () => Response.json({ courier_data: [] }) });
  assert.deepEqual(await empty.api.getShiprocketQuickCouriers(), []);
});

test("Quick assignment validates numeric IDs before auth and rejects standard or stale courier IDs", async () => {
  for (const ids of [[0, 9001], [789, -1], ["789", 9001], [789, "9001"], [NaN, 9001], [789, Number.MAX_SAFE_INTEGER + 1]]) {
    const client = createClient();
    await assert.rejects(client.api.assignShiprocketQuickCourier(...ids), createError(client.api, "rejected", "INVALID_INPUT"));
    assert.equal(client.calls.length, 0);
  }
  for (const courierId of [42, 9999]) {
    const client = createClient();
    await assert.rejects(client.api.assignShiprocketQuickCourier(789, courierId), createError(client.api, "rejected", "QUICK_COURIER_UNAVAILABLE"));
    assert.equal(client.counts.assign, 0);
  }
  const changed = createClient({ onCouriers: (_, counts) => Response.json({ courier_data: counts.couriers === 1
    ? [{ id: 9001, name: "Quick", is_hyperlocal: 1 }] : [] }) });
  await changed.api.getShiprocketQuickCouriers();
  await assert.rejects(changed.api.assignShiprocketQuickCourier(789, 9001), createError(changed.api, "rejected", "QUICK_COURIER_UNAVAILABLE"));
  assert.equal(changed.counts.couriers, 2);
  assert.equal(changed.counts.assign, 0);
});

test("Quick booking preparation failures are definite rejections with no write", async () => {
  for (const overrides of [
    { onAuth: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 401 }) },
    { onAuth: () => { throw new Error("UPSTREAM-PRIVATE private-test-password"); } },
    { onCouriers: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status: 403 }) },
    { onCouriers: () => { throw new DOMException("UPSTREAM-PRIVATE", "TimeoutError"); } },
  ]) {
    const client = createClient(overrides);
    await assert.rejects(client.api.assignShiprocketQuickCourier(789, 9001), createError(client.api, "rejected"));
    assert.equal(client.counts.assign, 0);
  }
});

test("Quick booking sends one explicit courier and treats asynchronous success as accepted pending", async () => {
  const client = createClient({ onAssign: (call) => {
    assert.equal(call.headers.get("authorization"), "Bearer private-test-token-1");
    assert.equal(call.headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(call.options.body), { shipment_id: 789, courier_id: 9001 });
    return Response.json({ success: true, message: "We are processing your request" });
  } });
  assert.deepEqual(await client.api.assignShiprocketQuickCourier(789, 9001), { accepted: true, awb: null });
  assert.deepEqual(client.calls.map((call) => call.url.pathname), [
    "/v1/external/auth/login", "/v1/external/courier/courierListWithCounts", "/v1/external/courier/assign/awb",
  ]);
  assert.equal(client.counts.assign, 1);
  assert.equal(client.counts.create, 0);
});

test("Quick assignment accepts a synchronous AWB only when both returned IDs match", async () => {
  const client = createClient({ onAssign: () => Response.json({ awb_assign_status: 1, response: { data: {
    shipment_id: "789", courier_company_id: "9001", awb_code: "QUICK12345", shipper_email: "UPSTREAM-PRIVATE",
  } } }) });
  assert.deepEqual(await client.api.assignShiprocketQuickCourier(789, 9001), { accepted: true, awb: "QUICK12345" });
  assert.equal(client.counts.assign, 1);
});

test("Quick assignment explicit rejections never refresh authentication or retry the write", async () => {
  for (const onAssign of [
    ...[400, 401, 403, 404, 422, 429].map((status) => () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status })),
    () => Response.json({ success: false, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status: false, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ status_code: 422, message: "UPSTREAM-PRIVATE" }),
    () => Response.json({ awb_assign_status: 0, response: { data: { message: "UPSTREAM-PRIVATE" } } }),
    () => Response.json({ errors: { courier_id: "UPSTREAM-PRIVATE" } }),
  ]) {
    const client = createClient({ onAssign });
    await assert.rejects(client.api.assignShiprocketQuickCourier(789, 9001), createError(client.api, "rejected", "QUICK_BOOKING_REJECTED"));
    assert.equal(client.counts.assign, 1);
    assert.equal(client.counts.auth, 1);
  }
});

test("Quick timeouts, mismatched IDs and ambiguous responses remain unknown without retry", async () => {
  const assignment = { awb_assign_status: 1, response: { data: { shipment_id: 789, courier_company_id: 9001, awb_code: "QUICK12345" } } };
  for (const onAssign of [
    () => { throw new DOMException("UPSTREAM-PRIVATE private-test-token-1", "TimeoutError"); },
    ...[408, 409, 500, 502, 503, 504].map((status) => () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status })),
    () => new Response("UPSTREAM-PRIVATE", { status: 200 }),
    () => Response.json({}),
    () => Response.json({ status_code: 500 }),
    () => Response.json({ awb_assign_status: 1 }),
    () => Response.json({ success: false, ...assignment }),
    () => Response.json({ success: true, shipment_id: 790 }),
    () => Response.json({ success: true, courier_id: 42 }),
    () => Response.json({ success: false, courier_id: 42 }),
    () => Response.json({ success: true, awb_code: "QUICK12345" }),
    () => Response.json({ success: true, awb_assign_status: "invalid" }),
    () => Response.json({ success: true, response: [] }),
    () => Response.json({ success: true, response: { success: false } }),
    () => Response.json({ success: true, data: { success: false } }),
    () => Response.json({ success: false, awb_code: "malformed\nawb" }),
    ...[{ shipment_id: 790 }, { shipment_id: null }, { courier_company_id: 42 },
      { courier_company_id: Number.MAX_SAFE_INTEGER + 1 }, { awb_code: "bad\nawb" }, { awb_code: null }]
      .map((patch) => () => Response.json({ ...assignment, response: { data: { ...assignment.response.data, ...patch } } })),
  ]) {
    const client = createClient({ onAssign });
    await assert.rejects(client.api.assignShiprocketQuickCourier(789, 9001), createError(client.api, "unknown", "QUICK_BOOKING_UNKNOWN"));
    assert.equal(client.counts.assign, 1);
    assert.equal(client.counts.auth, 1);
  }
});

test("Quick reconciliation reads courier and AWB only from the exact linked shipment", async () => {
  const client = createClient({ onOrder: () => Response.json({ data: {
    ...sampleExistingOrder, courier_id: 42, awb: "WRONG123",
    shipments: [
      { id: 790, order_id: 457, courier_id: 42, awb: "WRONG123" },
      { ...sampleExistingOrder.shipments, courier_id: "9001", courier: "Quick Test 2W", awb: "QUICK12345", phone: "UPSTREAM-PRIVATE" },
    ],
  } }) });
  assert.deepEqual(await client.api.getShiprocketOrder(456), {
    orderId: 456, shipmentId: 789, merchantOrderId: sampleOrder.order_id, total: 150, deliveryPincode: "110001", status: "NEW",
    courierId: 9001, awb: "QUICK12345", courierName: "Quick Test 2W",
  });
  for (const shipment of [
    { courier_id: "", courier: "", awb: null },
    { courier_id: -1, courier: null, awb: "bad\nawb" },
  ]) {
    const empty = createClient({ onOrder: () => Response.json({ data: {
      ...sampleExistingOrder, shipments: { ...sampleExistingOrder.shipments, ...shipment },
    } }) });
    const result = await empty.api.getShiprocketOrder(456);
    assert.equal(result.courierId, null);
    assert.equal(result.courierName, null);
    assert.equal(result.awb, null);
  }
});

test("order readback exposes the documented shipping method only when present and recognized", async () => {
  for (const [method, expected] of [["HL", "HL"], ["SR", "SR"], [null, null], ["", null], ["UPSTREAM-PRIVATE", null]]) {
    const client = createClient({ onOrder: () => Response.json({ data: { ...sampleExistingOrder, shipping_method: method } }) });
    assert.equal((await client.api.getShiprocketOrder(456)).shippingMethod, expected);
  }
  const absent = createClient();
  assert.equal(Object.hasOwn(await absent.api.getShiprocketOrder(456), "shippingMethod"), false);
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

// Shape follows the domestic shipment tracking example in Shiprocket's public
// Postman collection. `id` is a tracking record ID, not the shipment ID.
const sampleTracking = { tracking_data: {
  track_status: 1, shipment_status: 42,
  shipment_track: [{ id: 98765, shipment_id: 789, order_id: 456, awb_code: "AWB123456",
    current_status: "PICKED UP", courier_name: "Example Courier", delivered_date: null,
    consignee_name: "UPSTREAM-PRIVATE", delivered_to: "UPSTREAM-PRIVATE", edd: "2026-11-15 18:00:00" }],
  shipment_track_activities: [
    { date: "2026-11-11 14:00:00", activity: "Shipment picked up", location: "Kolkata hub" },
    { date: "2026-11-11 15:00:00", activity: "In transit", location: "Sorting facility" },
  ],
  track_url: "https://shiprocket.co//tracking/AWB123456", etd: "2026-11-14 18:00:00",
} };

test("tracking is read-only, verifies linked IDs, and returns only customer-safe fields", async () => {
  const client = createClient();
  assert.deepEqual(await client.api.getShiprocketTracking(789, 456), {
    available: true, status: "PICKED UP", courierName: "Example Courier", awb: "AWB123456",
    trackingUrl: "https://shiprocket.co//tracking/AWB123456",
    estimatedDeliveryAt: "2026-11-14T12:30:00.000Z", deliveredAt: null,
    events: [
      { date: "2026-11-11T09:30:00.000Z", status: "In transit", location: "Sorting facility" },
      { date: "2026-11-11T08:30:00.000Z", status: "Shipment picked up", location: "Kolkata hub" },
    ],
  });
  assert.equal(client.counts.tracking, 1);
  assert.equal(client.counts.create, 0);
  assert.equal(client.counts.order, 0);
  assert.deepEqual(client.calls.map((call) => call.url.pathname), [
    "/v1/external/auth/login", "/v1/external/courier/track/shipment/789",
  ]);
});

test("tracking rejects invalid inputs without network calls and mismatched provider identifiers", async () => {
  for (const ids of [[0, 456], [789, -1], ["789", 456], [789, "456"], [NaN, 456], [789, Number.MAX_SAFE_INTEGER + 1]]) {
    const client = createClient();
    await assert.rejects(client.api.getShiprocketTracking(...ids), safeError(client.api));
    assert.equal(client.calls.length, 0);
  }
  for (const invalid of [{ shipment_id: 790 }, { order_id: 457 }, { shipment_id: null }, { order_id: null }]) {
    const client = createClient({ onTracking: () => Response.json({ tracking_data: {
      ...sampleTracking.tracking_data, shipment_track: [{ ...sampleTracking.tracking_data.shipment_track[0], ...invalid }],
    } }) });
    await assert.rejects(client.api.getShiprocketTracking(789, 456), safeError(client.api));
  }
});

test("documented no-activities tracking response is pending without exposing upstream errors", async () => {
  for (const data of [
    { track_status: 0 },
    { track_status: "0", error: "Aahh! There is no activities found in our DB. Please have some patience it will be updated soon." },
    { track_status: 0, shipment_track: [], shipment_track_activities: null },
  ]) {
    const client = createClient({ onTracking: () => Response.json({ tracking_data: data }) });
    assert.deepEqual(await client.api.getShiprocketTracking(789, 456), {
      available: false, status: null, courierName: null, awb: null, trackingUrl: null,
      estimatedDeliveryAt: null, deliveredAt: null, events: [],
    });
  }
});

test("tracking rejects malformed data and provider failures rather than claiming it is pending", async () => {
  const bodies = [
    {}, { tracking_data: {} }, { tracking_data: [] },
    { tracking_data: { track_status: 0, error: "UPSTREAM-PRIVATE API permission denied" } },
    { tracking_data: { track_status: 0, status_code: 403 } },
    { tracking_data: { track_status: 0, success: false } },
    { tracking_data: { track_status: 0, shipment_track: sampleTracking.tracking_data.shipment_track } },
    { tracking_data: { ...sampleTracking.tracking_data, shipment_track: [] } },
    { tracking_data: { ...sampleTracking.tracking_data, shipment_track: [sampleTracking.tracking_data.shipment_track[0], sampleTracking.tracking_data.shipment_track[0]] } },
    { tracking_data: { ...sampleTracking.tracking_data, shipment_track_activities: {} } },
    { tracking_data: { ...sampleTracking.tracking_data, error: "UPSTREAM-PRIVATE" } },
    { tracking_data: sampleTracking.tracking_data, errors: { permission: "UPSTREAM-PRIVATE" } },
  ];
  for (const body of bodies) {
    const client = createClient({ onTracking: () => Response.json(body) });
    await assert.rejects(client.api.getShiprocketTracking(789, 456), safeError(client.api));
  }
  for (const status of [403, 404, 429, 500]) {
    const client = createClient({ onTracking: () => Response.json({ message: "UPSTREAM-PRIVATE" }, { status }) });
    await assert.rejects(client.api.getShiprocketTracking(789, 456), safeError(client.api));
  }
});

test("only known HTTPS Shiprocket tracking links are exposed and no link is fetched", async () => {
  for (const url of ["javascript:alert(1)", "https://shiprocket.co.evil.test/tracking/x", "https://evil.test/",
    "https://shiprocket.co@evil.test/", "https://user:password@shiprocket.co/tracking/x", "http://shiprocket.co/tracking/x",
    "https://shiprocket.co:444/tracking/x", "https://shiprocket.co\\@evil.test/", "https://shiprocket.co/\ntracking/x"]) {
    const client = createClient({ onTracking: () => Response.json({ tracking_data: { ...sampleTracking.tracking_data, track_url: url } }) });
    assert.equal((await client.api.getShiprocketTracking(789, 456)).trackingUrl, null);
    assert.equal(client.calls.length, 2);
  }
});

test("tracking dates keep explicit offsets, interpret domestic timestamps in India, and discard invalid dates", async () => {
  const client = createClient({ onTracking: () => Response.json({ tracking_data: {
    ...sampleTracking.tracking_data, etd: "2026-02-30 09:00:00",
    shipment_track: [{ ...sampleTracking.tracking_data.shipment_track[0], edd: "2026-11-15", delivered_date: "2026-11-14T12:00:00Z" }],
    shipment_track_activities: [
      { date: "2026-11-11T15:00:00+05:30", activity: "Explicit India offset" },
      { date: "2026-11-11T09:30:00Z", activity: "Explicit UTC" },
      { date: "2026-11-11 24:00:00", activity: "Invalid time" },
      { date: "2026-02-30 09:00:00", activity: "Invalid date" },
      { date: "0000-00-00 00:00:00", activity: "No date" },
      { date: "not a date", activity: "Invalid" },
    ],
  } }) });
  const result = await client.api.getShiprocketTracking(789, 456);
  assert.equal(result.estimatedDeliveryAt, "2026-11-14T18:30:00.000Z");
  assert.equal(result.deliveredAt, "2026-11-14T12:00:00.000Z");
  assert.equal(result.events.length, 2);
  assert.ok(result.events.every((event) => event.date === "2026-11-11T09:30:00.000Z"));
});

test("tracking output bounds event counts and text and omits malformed events", async () => {
  const client = createClient({ onTracking: () => Response.json({ tracking_data: {
    ...sampleTracking.tracking_data,
    shipment_track: [{ ...sampleTracking.tracking_data.shipment_track[0], current_status: "A".repeat(300), courier_name: "B".repeat(300), awb_code: "javascript:unsafe" }],
    shipment_track_activities: [null, {}, ...Array.from({ length: 60 }, () => ({ date: "2026-11-11 09:00:00", activity: "C".repeat(300), location: "D".repeat(300) }))],
  } }) });
  const result = await client.api.getShiprocketTracking(789, 456);
  assert.equal(result.status.length, 100);
  assert.equal(result.courierName.length, 100);
  assert.equal(result.awb, null);
  assert.equal(result.events.length, 50);
  assert.ok(result.events.every((event) => event.status.length === 160 && event.location.length === 160));
});
