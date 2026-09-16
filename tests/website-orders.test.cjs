const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const test = require("node:test");
const ts = require("typescript");
const { NextResponse } = require("next/server");

function load(file, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Buffer, Error, console: { error() {} }, process: { env: {} },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    }, ...globals,
  });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const customer = { name: "Buyer", email: "buyer@example.test", contact: "9876543210", addressLine1: "123 Street", city: "Delhi", state: "Delhi", pincode: "110001" };
const cart = { lines: [{ itemCode: "CARD1", name: "Invitation", basePrice: 100, price: 100, quantity: 50 }], amountPaise: 500000, currency: "INR", commission: 0 };
const body = { customer, items: [{ itemCode: "CARD1", quantity: 50 }] };
const request = (body, headers = {}) => new Request("https://shop.test/api/razorpay/order", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } });

function orderRoute({ user = null, saveError = false, linkError = false, gatewayError = false } = {}) {
  const calls = [];
  const route = load("app/api/razorpay/order/route.ts", {
    "next/server": { NextResponse },
    "@/lib/checkout": { resolveCartProducts: async () => cart },
    "@/lib/reseller": { getActiveResellerFromCookies: async () => null },
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    "@/lib/website-orders": {
      createWebsiteOrder: async (args) => { calls.push(["save", plain(args)]); if (saveError) throw new Error("database unavailable"); return "website-order-id"; },
      attachRazorpayOrder: async (...args) => { calls.push(["link", ...args]); if (linkError) throw new Error("database unavailable"); },
    },
    "@/lib/razorpay": { getRazorpay: () => ({ orders: { create: async (args) => {
      calls.push(["gateway", plain(args)]);
      if (gatewayError) throw new Error("gateway unavailable");
      return { id: "order_test", amount: cart.amountPaise, currency: "INR" };
    } } }) },
  }, { process: { env: { NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_public" } } });
  return { route, calls };
}

test("checkout saves authoritative cart and verified owner before gateway order creation", async () => {
  for (const user of [null, { id: "verified-user-id" }]) {
    const { route, calls } = orderRoute({ user });
    const response = await route.POST(request({ ...body, user_id: "forged", amount: 1, customer: { ...customer, user_id: "forged" } }));
    assert.equal(response.status, 200);
    assert.deepEqual(calls.map(([kind]) => kind), ["save", "gateway", "link"]);
    assert.deepEqual(calls[0][1].cart, cart);
    assert.equal(calls[0][1].userId, user?.id ?? null);
    assert.equal(calls[1][1].receipt, "website-order-id");
    assert.equal(calls[1][1].amount, cart.amountPaise);
    assert.deepEqual(await response.json(), { websiteOrderId: "website-order-id", orderId: "order_test", amount: 500000, currency: "INR", keyId: "rzp_test_public" });
  }
});

test("missing storage blocks Razorpay creation and link failures never expose an order to checkout", async () => {
  for (const options of [{ saveError: true }, { linkError: true }, { gatewayError: true }]) {
    const { route, calls } = orderRoute(options);
    const response = await route.POST(request(body));
    assert.ok(response.status >= 500);
    const result = await response.json();
    assert.equal(result.orderId, undefined);
    if (options.saveError) assert.deepEqual(calls.map(([kind]) => kind), ["save"]);
    if (options.gatewayError) assert.deepEqual(calls.map(([kind]) => kind), ["save", "gateway"]);
  }
  const { route, calls } = orderRoute();
  for (const invalid of [null, {}, { ...body, items: [null] }, { ...body, items: [] }]) {
    assert.equal((await route.POST(request(invalid))).status, 400);
  }
  assert.equal(calls.length, 0);
});

function paymentStorage(overrides = {}) {
  const state = { fetched: 0, writes: [], payment: { id: "pay_test", order_id: "order_test", amount: 500000, currency: "INR", status: "captured", ...overrides } };
  const db = {
    from() { return this; }, select() { return this; }, eq() { return this; },
    single: async () => ({ data: { id: "website-order-id", amount_paise: 500000, currency: "INR", payment_status: "pending" }, error: null }),
    rpc: async (name, args) => { state.writes.push([name, plain(args)]); return { data: { id: "website-order-id" }, error: null }; },
  };
  const storage = load("lib/website-orders.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => db },
    "@/lib/razorpay": { getRazorpay: () => ({ payments: { fetch: async () => { state.fetched++; return state.payment; } } }) },
  });
  return { storage, state, db };
}
const references = { razorpayOrderId: "order_test", razorpayPaymentId: "pay_test" };

test("confirmation requires matching order, amount, currency and capture before marking paid", async () => {
  for (const overrides of [{ order_id: "order_other" }, { id: "pay_other" }, { amount: 100 }, { currency: "USD" }, { status: "failed" }]) {
    const { storage, state } = paymentStorage(overrides);
    await assert.rejects(storage.confirmWebsiteOrderPayment(references), storage.InvalidOrderPaymentError);
    assert.equal(state.writes.length, 0);
  }
  const { storage, state } = paymentStorage();
  assert.deepEqual(plain(await storage.confirmWebsiteOrderPayment(references)), { id: "website-order-id", paymentStatus: "paid" });
  assert.equal(state.writes[0][0], "mark_website_order_paid");
  assert.deepEqual(state.writes[0][1], { p_razorpay_order_id: "order_test", p_razorpay_payment_id: "pay_test", p_amount_paise: 500000, p_currency: "INR" });
});

test("authorization stays pending and an absent website order cannot create a payment record", async () => {
  const { storage, state, db } = paymentStorage({ status: "authorized" });
  assert.equal((await storage.confirmWebsiteOrderPayment(references)).paymentStatus, "pending");
  assert.equal(state.writes.length, 0);
  db.single = async () => ({ data: { id: "website-order-id", amount_paise: 500000, currency: "INR", payment_status: "paid" }, error: null });
  assert.equal((await storage.confirmWebsiteOrderPayment(references)).paymentStatus, "pending");
  db.single = async () => ({ data: null, error: { code: "PGRST116" } });
  await assert.rejects(storage.confirmWebsiteOrderPayment(references), /storage failed/);
  assert.equal(state.fetched, 2);
});

test("order snapshot includes shipping, contact details and server-resolved line prices", async () => {
  const { storage, db } = paymentStorage();
  let inserted;
  db.insert = (data) => { inserted = plain(data); return db; };
  const customerSnapshot = { ...customer, phone: customer.contact, addressLine2: "Floor 2", country: "India", notes: "Print in gold" };
  await storage.createWebsiteOrder({ cart, customer: customerSnapshot, userId: null });
  assert.equal(inserted.customer_phone, customer.contact);
  assert.equal(inserted.shipping_address.addressLine2, "Floor 2");
  assert.equal(inserted.notes, "Print in gold");
  assert.deepEqual(inserted.items, cart.lines);
  assert.equal(inserted.amount_paise, cart.amountPaise);
  assert.equal(inserted.user_id, null);
});

const secret = "test-only-secret";
const signatures = load("lib/razorpay.ts", { razorpay: class {}, crypto }, { process: { env: { RAZORPAY_KEY_SECRET: secret, RAZORPAY_WEBHOOK_SECRET: secret } } });
test("verification rejects tampering; storage delays return pending instead of claiming a saved payment", async () => {
  let confirmations = 0;
  let fail = true;
  const route = load("app/api/razorpay/verify/route.ts", {
    "next/server": { NextResponse }, "@/lib/razorpay": signatures,
    "@/lib/website-orders": { InvalidOrderPaymentError: class extends Error {}, confirmWebsiteOrderPayment: async () => {
      confirmations++; if (fail) throw new Error("offline"); return { id: "website-order-id", paymentStatus: "paid" };
    } },
  });
  const payment = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: "invalid" };
  assert.equal((await route.POST(request(null))).status, 400);
  assert.equal((await route.POST(request(payment))).status, 400);
  assert.equal(confirmations, 0);
  payment.razorpay_signature = crypto.createHmac("sha256", secret).update("order_test|pay_test").digest("hex");
  let response = await route.POST(request(payment));
  assert.deepEqual(await response.json(), { verified: true, paymentId: "pay_test", websiteOrderId: null, paymentPending: true });
  fail = false;
  response = await route.POST(request(payment));
  assert.equal((await response.json()).paymentPending, false);
});

test("webhook verifies raw signatures, rejects malformed events, and requests retries on storage failure", async () => {
  let calls = 0;
  let fail = false;
  const route = load("app/api/razorpay/webhook/route.ts", {
    "next/server": { NextResponse }, "@/lib/razorpay": signatures,
    "@/lib/website-orders": { confirmWebsiteOrderPayment: async () => {
      calls++; if (fail) throw new Error("offline"); return { id: "website-order-id", paymentStatus: "paid" };
    } },
  });
  const event = { event: "payment.captured", payload: { payment: { entity: { id: "pay_test", order_id: "order_test" } } } };
  const signed = (value) => request(value, { "x-razorpay-signature": crypto.createHmac("sha256", secret).update(JSON.stringify(value)).digest("hex") });
  assert.equal((await route.POST(request(event))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await route.POST(signed({ event: "payment.captured" }))).status, 400);
  assert.equal((await route.POST(signed({ event: "payment.failed" }))).status, 200);
  assert.equal(calls, 0);
  assert.equal((await route.POST(signed(event))).status, 200);
  assert.equal((await route.POST(signed({ ...event, event: "order.paid" }))).status, 200);
  fail = true;
  assert.equal((await route.POST(signed(event))).status, 500);
});

test("order admin client requires server credentials and never uses cached or customer-authenticated reads", async () => {
  let config;
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-only" };
  const admin = load("lib/supabase/admin.ts", {
    "server-only": {}, "@supabase/supabase-js": { createClient: (...args) => { config = args; return {}; } },
  }, { process: { env }, fetch: async (_input, init) => init });
  assert.throws(() => admin.getSupabaseAdminClient(), /SUPABASE_SECRET_KEY/);
  env.SUPABASE_SECRET_KEY = "server-only-secret";
  admin.getSupabaseAdminClient();
  assert.equal(config[1], "server-only-secret");
  assert.equal(config[2].auth.persistSession, false);
  assert.equal((await config[2].global.fetch("example", { cache: "force-cache" })).cache, "no-store");
});
