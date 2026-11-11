const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const subtotalPaise = 50_000;
const shippingAmountPaise = 5_572;
const totalPaise = subtotalPaise + shippingAmountPaise;
const trackingToken = "a".repeat(43);
const cart = {
  lines: [{ itemCode: "CARD-1", printName: "", name: "Invitation", basePrice: 9, price: 10, quantity: 50, weightGrams: 40 }],
  amountPaise: subtotalPaise, currency: "INR", commission: 50,
};
const quote = {
  pincode: "400001", subtotalPaise, amountPaise: shippingAmountPaise, totalPaise,
  currency: "INR", weightKg: 2, estimatedDeliveryDays: 3, courierId: 10,
  courierName: "Test Courier", expiresAt: Date.now() + 5 * 60_000,
};
const customer = {
  name: "Test Customer", email: "customer@example.test", contact: "9999999999",
  addressLine1: "Test address", addressLine2: "", city: "Mumbai", state: "Maharashtra",
  pincode: "400001", country: "India", notes: "",
};

function loadModule(filename, imports = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", filename), "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  const scope = { process: { env: { NEXT_PUBLIC_RAZORPAY_KEY_ID: "test-public-key" } }, console: { error() {}, warn() {}, log() {} }, ...globals };
  new Function("require", "module", "exports", ...Object.keys(scope), outputText)(
    (name) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
      return imports[name];
    }, loaded, loaded.exports, ...Object.values(scope),
  );
  return loaded.exports;
}

function createRoute(filename, { quoteError } = {}) {
  const calls = { resolve: [], quote: [], save: [], createPayment: [], attach: [] };
  class ShippingQuoteError extends Error {
    constructor(code, message, status = 422) { super(message); this.code = code; this.status = status; }
  }
  const shipping = loadModule("lib/shipping.ts");
  const checkout = loadModule("lib/checkout.ts", {
    "@/lib/catalog": { buildErpProductList: async () => [] },
    "@/lib/product-quantity": loadModule("lib/product-quantity.ts"),
    "@/lib/reseller": { applyMarginToPrice: (price, margin) => Math.round(price * (1 + margin / 100)) },
  });
  const route = loadModule(filename, {
    "server-only": {},
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/shipping": shipping,
    "@/lib/checkout": { ...checkout, resolveCartProducts: async (items, reseller) => {
      calls.resolve.push({ items, reseller });
      return structuredClone(cart);
    } },
    "@/lib/cart-shipping": { ShippingQuoteError, quoteCartShipping: async (input, pincode, options) => {
      calls.quote.push({ cart: input, pincode, options });
      if (quoteError) throw new ShippingQuoteError(...quoteError);
      return { ...quote, pincode };
    } },
    "@/lib/reseller": { getActiveResellerFromCookies: async () => ({ code: "TEST-RESELLER", active: true, marginPercent: 10 }) },
    "@/lib/razorpay": { getRazorpay: () => ({ orders: { create: async (input) => {
      calls.createPayment.push(input);
      return { id: "order_test123", amount: input.amount, currency: input.currency };
    } } }) },
    "@/lib/website-orders": {
      createWebsiteOrder: async (input) => { calls.save.push(input); return { id: "website-order-test", trackingToken }; },
      attachRazorpayOrder: async (...args) => { calls.attach.push(args); },
    },
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => ({
      auth: { getUser: async () => ({ data: { user: null } }) },
    }) },
  });
  const post = (body) => {
    const request = new Request("http://localhost/api/test", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body),
    });
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    return route.POST(request);
  };
  return { calls, post };
}

function paymentBody(overrides = {}) {
  return {
    items: [{ itemCode: "CARD-1", slug: "invitation", quantity: 50 }], customer,
    expectedAmountPaise: totalPaise, expectedShippingAmountPaise: shippingAmountPaise,
    ...overrides,
  };
}

test("shipping quote uses server-resolved products and prices, ignoring browser price and weight claims", async () => {
  const fixture = createRoute("app/api/shipping/quote/route.ts");
  const response = await fixture.post({
    pincode: "400001", items: [{ itemCode: "CARD-1", slug: "invitation", quantity: 50, price: 0.01, weightGrams: 0.001 }],
    amountPaise: 1, shippingAmountPaise: 0, weightKg: 0.001,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.calls.resolve[0].items, [{ itemCode: "CARD-1", slug: "invitation", quantity: 50 }]);
  assert.equal(fixture.calls.quote.length, 1);
  assert.deepEqual(fixture.calls.quote[0].cart, cart);
  assert.equal(fixture.calls.quote[0].pincode, "400001");
  const body = await response.json();
  const returnedQuote = body.quote ?? body;
  assert.equal(returnedQuote.amountPaise, shippingAmountPaise);
  assert.equal(returnedQuote.totalPaise, totalPaise);
});

test("an invalid shipping pincode is rejected before catalogue or courier lookups", async () => {
  const fixture = createRoute("app/api/shipping/quote/route.ts");
  const response = await fixture.post({ pincode: "123", items: [{ itemCode: "CARD-1", quantity: 50 }] });
  assert.equal(response.status, 400);
  assert.equal(fixture.calls.resolve.length, 0);
  assert.equal(fixture.calls.quote.length, 0);
});

test("payment refuses a tampered or stale total before creating either order", async () => {
  const fixture = createRoute("app/api/razorpay/order/route.ts");
  const response = await fixture.post(paymentBody({ expectedAmountPaise: 100, amountPaise: 1, shippingAmountPaise: 0 }));
  assert.equal(response.status, 409);
  const changed = await response.json();
  assert.equal(changed.code, "QUOTE_CHANGED");
  assert.deepEqual(changed.quote, quote);
  assert.equal(fixture.calls.save.length, 0);
  assert.equal(fixture.calls.createPayment.length, 0);
});

test("payment also refuses a changed shipping fee even if the browser sends the correct gross total", async () => {
  const fixture = createRoute("app/api/razorpay/order/route.ts");
  const response = await fixture.post(paymentBody({ expectedShippingAmountPaise: shippingAmountPaise - 1 }));
  assert.equal(response.status, 409);
  assert.equal(fixture.calls.save.length, 0);
  assert.equal(fixture.calls.createPayment.length, 0);
});

test("payment requires explicit valid expected totals and cannot fall back to product-only charging", async () => {
  for (const override of [
    { expectedAmountPaise: undefined }, { expectedShippingAmountPaise: undefined },
    { expectedAmountPaise: -1 }, { expectedShippingAmountPaise: -1 },
    { expectedAmountPaise: 1.5 }, { expectedShippingAmountPaise: 1.5 },
  ]) {
    const fixture = createRoute("app/api/razorpay/order/route.ts");
    const response = await fixture.post(paymentBody(override));
    assert.ok([400, 409].includes(response.status));
    assert.equal(fixture.calls.save.length, 0);
    assert.equal(fixture.calls.createPayment.length, 0);
  }
});

test("successful checkout charges the authoritative merchandise plus shipping total", async () => {
  const fixture = createRoute("app/api/razorpay/order/route.ts");
  const response = await fixture.post(paymentBody());
  assert.equal(response.status, 200);
  assert.equal(fixture.calls.quote.length, 1);
  assert.deepEqual(fixture.calls.quote[0].cart, cart);
  assert.equal(fixture.calls.quote[0].pincode, customer.pincode);
  assert.deepEqual(fixture.calls.quote[0].options, { refresh: true });
  assert.equal(fixture.calls.save.length, 1);
  assert.equal(fixture.calls.createPayment.length, 1);
  assert.equal(fixture.calls.createPayment[0].amount, totalPaise);
  assert.equal(fixture.calls.save[0].cart.amountPaise, totalPaise);
  assert.deepEqual(fixture.calls.save[0].cart.shipping, quote);
  assert.equal(fixture.calls.save[0].cart.commission, cart.commission);
  assert.equal(fixture.calls.attach.length, 1);
  const result = await response.json();
  assert.equal(result.amount, totalPaise);
  assert.equal(result.websiteOrderId, "website-order-test");
  assert.equal(result.trackingToken, trackingToken);
  assert.equal(result.trackingTokenHash, undefined);
  assert.match(response.headers.get("Cache-Control"), /private, no-store/);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(JSON.stringify(fixture.calls.createPayment).includes(trackingToken), false, "Private token must not be sent to Razorpay");
});

test("unavailable shipping cannot create an order or initiate payment", async () => {
  const fixture = createRoute("app/api/razorpay/order/route.ts", {
    quoteError: ["UNSERVICEABLE", "Delivery is unavailable for this pincode.", 422],
  });
  const response = await fixture.post(paymentBody());
  assert.equal(response.status, 422);
  assert.equal(fixture.calls.save.length, 0);
  assert.equal(fixture.calls.createPayment.length, 0);
});

test("domestic shipping checkout rejects non-Indian delivery countries", async () => {
  const fixture = createRoute("app/api/razorpay/order/route.ts");
  const response = await fixture.post(paymentBody({ customer: { ...customer, country: "United States" } }));
  assert.equal(response.status, 400);
  assert.equal(fixture.calls.quote.length, 0);
  assert.equal(fixture.calls.save.length, 0);
  assert.equal(fixture.calls.createPayment.length, 0);
});

test("the website order snapshot stores the accepted shipping fee and gross payment total", async () => {
  let saved;
  const tracking = loadModule("lib/order-tracking-token.ts", { "server-only": {}, "node:crypto": require("node:crypto") });
  const websiteOrders = loadModule("lib/website-orders.ts", {
    "server-only": {},
    "@/lib/order-tracking-token": tracking,
    "@/lib/razorpay": {
      getRazorpay: () => assert.fail("Saving a snapshot must not initiate payment"),
      getRazorpayPaymentContext: () => ({ mode: "test", keyId: "rzp_test_snapshot" }),
    },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => ({
      from: (table) => {
        assert.equal(table, "website_orders");
        return { insert: (row) => {
          saved = row;
          return { select: () => ({ single: async () => ({ data: { id: "saved-test-order" }, error: null }) }) };
        } };
      },
    }) },
  });
  const result = await websiteOrders.createWebsiteOrder({
    customer: { ...customer, phone: customer.contact, paymentMode: "live" },
    cart: { ...cart, amountPaise: totalPaise, shipping: quote, paymentMode: "live", paymentKeyId: "rzp_live_browser_claim" },
    userId: null,
    resellerCode: "TEST-RESELLER",
    paymentMode: "live",
  });
  assert.equal(result.id, "saved-test-order");
  assert.equal(tracking.verifyOrderTrackingToken(result.trackingToken, saved.shipping_address.trackingTokenHash), true);
  assert.equal(JSON.stringify(saved).includes(result.trackingToken), false, "Only the hash may be persisted");
  assert.equal(saved.amount_paise, totalPaise);
  assert.equal(saved.shipping_address.pincode, quote.pincode);
  assert.deepEqual(saved.shipping_address.shippingQuote, quote);
  assert.equal(saved.shipping_address.paymentMode, "test");
  assert.equal(saved.shipping_address.paymentKeyId, "rzp_test_snapshot");
  assert.deepEqual(saved.items, cart.lines);
  assert.equal(saved.commission_paise, cart.commission * 100);
});

test("checkout resolution takes prices and unit weights from the catalogue", async () => {
  const checkout = loadModule("lib/checkout.ts", {
    "@/lib/catalog": { buildErpProductList: async () => [{
      itemCode: "CARD-1", slug: "invitation", name: "Invitation", subject: "Wedding Card",
      printName: "", price: 10, hasPrice: true, dimensions: { weight: 40 },
    }] },
    "@/lib/product-quantity": loadModule("lib/product-quantity.ts"),
    "@/lib/reseller": { applyMarginToPrice: (price, margin) => Math.round(price * (1 + margin / 100)) },
  });
  const resolved = await checkout.resolveCartProducts([
    { itemCode: "CARD-1", slug: "invitation", quantity: 50, price: 0.01, weightGrams: 0.001 },
  ]);
  assert.equal(resolved.amountPaise, subtotalPaise);
  assert.equal(resolved.lines[0].price, 10);
  assert.equal(resolved.lines[0].weightGrams, 40);
});
