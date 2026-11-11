const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

const customer = {
  name: "Test Customer", email: "test@example.test", phone: "9999999999",
  addressLine1: "1 Test Street", addressLine2: "Unit 2", city: "Mumbai", state: "Maharashtra", pincode: "400001", country: "India", notes: "",
};
const quote = {
  service: "quick", deliveryPlaceId: "ChIJ_TEST_DELIVERY_BUILDING", deliveryLocation: { latitude: 19.08, longitude: 72.88 },
  pincode: "400001", subtotalPaise: 50000, amountPaise: 5500, totalPaise: 55500,
  currency: "INR", weightKg: 2, courierId: null, courierName: "Shiprocket Quick", estimatedDeliveryDays: null, expiresAt: 1900000000000,
};

function fixture() {
  const inserts = [];
  const api = load("lib/website-orders.ts", {
    "server-only": {},
    "@/lib/shipping": load("lib/shipping.ts"),
    "@/lib/order-tracking-token": { createOrderTrackingToken: () => ({ token: "PRIVATE_TRACKING_TOKEN", hash: "test-token-hash" }) },
    "@/lib/razorpay": {
      getRazorpayPaymentContext: () => ({ mode: "test", keyId: "rzp_test_fixture" }),
      getRazorpay: () => assert.fail("Order persistence does not call the payment provider"),
    },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => ({
      from: () => ({ insert: (row) => {
        inserts.push(structuredClone(row));
        return { select: () => ({ single: async () => ({ data: { id: "mock-order" }, error: null }) }) };
      } }),
    }) },
  });
  const save = (shipping) => api.createWebsiteOrder({ customer, userId: null, cart: {
    lines: [], amountPaise: 55500, currency: "INR", commission: 0, shipping,
  } });
  return { inserts, save };
}

test("Google-derived coordinates stay out of durable orders while the place reference and accepted totals survive", async () => {
  const { inserts, save } = fixture();
  const input = structuredClone(quote);
  await save(input);
  assert.equal(inserts.length, 1);
  const saved = inserts[0].shipping_address.shippingQuote;
  assert.equal(saved.deliveryPlaceId, quote.deliveryPlaceId);
  assert.equal(Object.hasOwn(saved, "deliveryLocation"), false);
  assert.equal(saved.amountPaise, quote.amountPaise);
  assert.equal(saved.totalPaise, quote.totalPaise);
  assert.deepEqual(input, quote, "Storage sanitization must not mutate the active accepted quote");
  assert.doesNotMatch(JSON.stringify(inserts), /latitude|longitude|PRIVATE_TRACKING_TOKEN/);
});

test("legacy coordinate-only and standard quotes keep their established durable snapshots", async () => {
  const legacy = { ...quote };
  delete legacy.deliveryPlaceId;
  const standard = { ...legacy, service: "standard", courierId: 1, courierName: "Courier" };
  delete standard.deliveryLocation;
  const { inserts, save } = fixture();
  await save(legacy);
  await save(standard);
  assert.deepEqual(inserts[0].shipping_address.shippingQuote, legacy);
  assert.deepEqual(inserts[1].shipping_address.shippingQuote, standard);
});

test("invalid Google references fail before persistence instead of storing their coordinates", async () => {
  for (const deliveryPlaceId of ["", "bad place id", null, 123, "x".repeat(513)]) {
    const { inserts, save } = fixture();
    await assert.rejects(save({ ...quote, deliveryPlaceId }), /delivery location reference/i);
    assert.equal(inserts.length, 0);
  }
  const { inserts, save } = fixture();
  await assert.rejects(save({ ...quote, service: "standard" }), /delivery location reference/i);
  assert.equal(inserts.length, 0);
});
