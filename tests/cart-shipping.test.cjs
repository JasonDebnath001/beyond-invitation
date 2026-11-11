const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

const FIXED_NOW = 1_800_000_000_000;
const TestClock = class extends Date { static now() { return FIXED_NOW; } };

function loadModule(filename, imports = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", filename), "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  const scope = { Date: TestClock, process: { env: { NEXT_PUBLIC_RAZORPAY_KEY_ID: "test-public-key" } }, ...globals };
  new Function("require", "module", "exports", ...Object.keys(scope), outputText)(
    (name) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
      return imports[name];
    }, loaded, loaded.exports, ...Object.values(scope),
  );
  return loaded.exports;
}

function cart(overrides = {}) {
  return {
    lines: [{ itemCode: "CARD-1", printName: "", name: "Invitation", basePrice: 10, price: 10, quantity: 50, weightGrams: 40 }],
    amountPaise: 50_000,
    currency: "INR",
    commission: 0,
    ...overrides,
  };
}

function createQuoter(onRates, onQuickRates) {
  const calls = [];
  const quickCalls = [];
  let now = FIXED_NOW;
  const clock = class extends Date { static now() { return now; } };
  class ShiprocketError extends Error {
    constructor(code, message, httpStatus) { super(message); this.code = code; this.httpStatus = httpStatus; }
  }
  const shipping = loadModule("lib/shipping.ts");
  const api = loadModule("lib/cart-shipping.ts", {
    "server-only": {},
    "@/lib/shipping": shipping,
    "@/lib/shiprocket": {
      ShiprocketError,
      getShiprocketQuickRates: async (input) => {
        quickCalls.push(input);
        return onQuickRates ? onQuickRates(input, ShiprocketError) : { couriers: [{ name: "Shiprocket Quick", rate: 65 }] };
      },
      getShiprocketRates: async (input) => {
        calls.push(input);
        return onRates ? onRates(input, ShiprocketError) : {
          couriers: [{ id: 10, name: "Test Courier", rate: 55.72, estimatedDeliveryDays: 3 }],
        };
      },
    },
  }, { Date: clock });
  return { api, calls, quickCalls, ShiprocketError, advance: (milliseconds) => { now += milliseconds; } };
}

const quickSelection = { service: "quick", deliveryLocation: { latitude: 19.076, longitude: 72.8777 } };

test("Quick uses the exact delivery point and authoritative weight, adding INR 50 only once", async () => {
  const fixture = createQuoter();
  const quote = await fixture.api.quoteCartShipping(cart(), "400001", quickSelection);
  assert.deepEqual(fixture.quickCalls, [{ deliveryPincode: "400001", deliveryLocation: quickSelection.deliveryLocation, weightKg: 2, cod: false }]);
  assert.equal(fixture.calls.length, 0);
  assert.equal(quote.service, "quick");
  assert.deepEqual(quote.deliveryLocation, quickSelection.deliveryLocation);
  assert.equal(quote.amountPaise, 11_500);
  assert.equal(quote.totalPaise, 61_500);
  assert.equal(quote.courierId, null, "A generic Quick quote must not invent a courier ID");
  assert.equal(quote.estimatedDeliveryDays, null);
});

test("Quick cannot reuse another service or location quote, and cached locations are isolated from callers", async () => {
  const fixture = createQuoter();
  const first = await fixture.api.quoteCartShipping(cart(), "400001", quickSelection);
  first.deliveryLocation.latitude = 0;
  const cached = await fixture.api.quoteCartShipping(cart(), "400001", quickSelection);
  assert.deepEqual(cached.deliveryLocation, quickSelection.deliveryLocation);
  assert.equal(cached.amountPaise, 11_500);
  assert.equal(fixture.quickCalls.length, 1);
  await fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, deliveryLocation: { ...quickSelection.deliveryLocation, latitude: 19.08 } });
  await fixture.api.quoteCartShipping(cart(), "400001");
  await fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, refresh: true });
  assert.equal(fixture.quickCalls.length, 3);
  assert.equal(fixture.calls.length, 1);
});

test("Quick quotes preserve the Google reference and keep different places out of each other's cache", async () => {
  const fixture = createQuoter();
  const first = await fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, deliveryPlaceId: "ChIJPlaceOne" });
  const second = await fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, deliveryPlaceId: "ChIJPlaceTwo" });
  assert.equal(first.deliveryPlaceId, "ChIJPlaceOne");
  assert.equal(second.deliveryPlaceId, "ChIJPlaceTwo");
  assert.equal(fixture.quickCalls.length, 2);
  const cached = await fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, deliveryPlaceId: "ChIJPlaceOne" });
  assert.equal(cached.deliveryPlaceId, "ChIJPlaceOne");
  assert.equal(fixture.quickCalls.length, 2);
  for (const deliveryPlaceId of ["", "https://bad.invalid", "x".repeat(513), null, 123]) {
    await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001", { ...quickSelection, deliveryPlaceId }),
      (error) => error.code === "INVALID_DELIVERY_LOCATION");
  }
  assert.equal(fixture.quickCalls.length, 2);
});

test("unknown delivery services and unconfirmed Quick locations fail before provider requests", async () => {
  for (const selection of [{ service: "other" }, { service: null }, { service: "quick" },
    { service: "quick", deliveryLocation: { latitude: "19", longitude: 72 } },
    { service: "quick", deliveryLocation: { latitude: 91, longitude: 72 } },
    { service: "quick", deliveryLocation: { latitude: 19, longitude: Infinity } }]) {
    const fixture = createQuoter();
    await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001", selection), (error) => error.status === 400);
    assert.equal(fixture.calls.length + fixture.quickCalls.length, 0);
  }
});

test("unavailable Quick never silently becomes standard or free shipping", async () => {
  const fixture = createQuoter(undefined, () => ({ couriers: [] }));
  await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001", quickSelection), (error) => error.code === "UNSERVICEABLE");
  assert.equal(fixture.calls.length, 0);
  const zero = createQuoter(undefined, () => ({ couriers: [{ name: "Shiprocket Quick", rate: 0 }] }));
  assert.equal((await zero.api.quoteCartShipping(cart(), "400001", quickSelection)).amountPaise, 5_000);
});

test("cart quotes derive whole shipment kilograms from authoritative per-unit grams and quantities", async () => {
  const fixture = createQuoter();
  const order = cart({ lines: [
    { ...cart().lines[0], quantity: 50, weightGrams: 40.005 },
    { ...cart().lines[0], itemCode: "CARD-2", quantity: 25, weightGrams: 25.003 },
  ] });
  const quote = await fixture.api.quoteCartShipping(order, "400001");
  assert.deepEqual(fixture.calls, [{ deliveryPincode: "400001", weightKg: 2.626, cod: false }]);
  assert.equal(quote.weightKg, 2.626);
  assert.equal(quote.pincode, "400001");
});

test("the cheapest valid courier rate includes a flat INR 50 markup once per order", async () => {
  const fixture = createQuoter(() => ({ couriers: [
    { id: 30, name: "Slower Expensive", rate: 100, estimatedDeliveryDays: 4 },
    { id: 20, name: "Lowest", rate: 54.555, estimatedDeliveryDays: 3 },
    { id: 10, name: "Faster", rate: 75.25, estimatedDeliveryDays: 1 },
  ] }));
  const quote = await fixture.api.quoteCartShipping(cart(), "400001");
  assert.deepEqual(quote, {
    pincode: "400001", subtotalPaise: 50_000, amountPaise: 10_456, totalPaise: 60_456,
    currency: "INR", weightKg: 2, estimatedDeliveryDays: 3, courierId: 20,
    courierName: "Lowest", expiresAt: FIXED_NOW + 5 * 60_000,
  });
});

test("a valid zero-rate courier still includes the INR 50 shipping markup", async () => {
  const fixture = createQuoter(() => ({ couriers: [
    { id: 10, name: "Zero Rate Courier", rate: 0, estimatedDeliveryDays: 3 },
  ] }));
  const quote = await fixture.api.quoteCartShipping(cart(), "400001");
  assert.equal(quote.amountPaise, 5_000);
  assert.equal(quote.totalPaise, 55_000);
});

test("invalid pincodes fail before contacting Shiprocket", async () => {
  for (const pincode of ["", "123", "000001", "40000x", "4000017", null, 400001]) {
    const fixture = createQuoter();
    await assert.rejects(fixture.api.quoteCartShipping(cart(), pincode), (error) => {
      assert.ok(error instanceof fixture.api.ShippingQuoteError);
      assert.equal(error.code, "INVALID_PINCODE");
      return true;
    });
    assert.equal(fixture.calls.length, 0);
  }
});

test("a missing or invalid item weight never gets a fictitious free or minimum-weight quote", async () => {
  for (const weightGrams of [undefined, null, 0, -1, NaN, Infinity]) {
    const fixture = createQuoter();
    const order = cart({ lines: [{ ...cart().lines[0], weightGrams }] });
    await assert.rejects(fixture.api.quoteCartShipping(order, "400001"), (error) => {
      assert.ok(error instanceof fixture.api.ShippingQuoteError);
      assert.equal(error.code, "WEIGHT_MISSING");
      return true;
    });
    assert.equal(fixture.calls.length, 0);
  }
});

test("empty carts and invalid quantities cannot produce shipping quotes", async () => {
  const invalidOrders = [cart({ lines: [] }), ...[0, -1, 0.5, NaN, Infinity].map((quantity) =>
    cart({ lines: [{ ...cart().lines[0], quantity }] }))];
  for (const order of invalidOrders) {
    const fixture = createQuoter();
    await assert.rejects(fixture.api.quoteCartShipping(order, "400001"));
    assert.equal(fixture.calls.length, 0);
  }
});

test("an unserviceable pincode is not represented as zero-cost shipping", async () => {
  const fixture = createQuoter(() => ({ couriers: [] }));
  await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001"), (error) => {
    assert.ok(error instanceof fixture.api.ShippingQuoteError);
    assert.equal(error.code, "UNSERVICEABLE");
    return true;
  });
});

test("provider failures are translated without leaking provider messages or credentials", async () => {
  const fixture = createQuoter((input, ProviderError) => {
    throw new ProviderError("AUTH_FAILED", "UPSTREAM-PRIVATE secret-token", 401);
  });
  await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001"), (error) => {
    assert.ok(error instanceof fixture.api.ShippingQuoteError);
    assert.equal(error.code, "SHIPROCKET_UNAVAILABLE");
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /UPSTREAM-PRIVATE|secret-token/);
    return true;
  });
});

test("Shiprocket's not-serviceable response is translated to UNSERVICEABLE", async () => {
  const fixture = createQuoter((input, ProviderError) => {
    throw new ProviderError("REQUEST_FAILED", "UPSTREAM-PRIVATE", 404);
  });
  await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001"), (error) => {
    assert.equal(error.code, "UNSERVICEABLE");
    assert.doesNotMatch(error.message, /UPSTREAM-PRIVATE/);
    return true;
  });
});

test("invalid provider prices are never charged as shipping", async () => {
  for (const rate of [undefined, null, -1, NaN, Infinity]) {
    const fixture = createQuoter(() => ({ couriers: [
      { id: 10, name: "Test Courier", rate, estimatedDeliveryDays: 3 },
    ] }));
    await assert.rejects(fixture.api.quoteCartShipping(cart(), "400001"));
  }
});

test("cart estimates can reuse a quote but payment refresh and expiry force fresh rates", async () => {
  let currentRate = 55;
  const fixture = createQuoter(() => ({ couriers: [
    { id: 10, name: "Test Courier", rate: currentRate, estimatedDeliveryDays: 3 },
  ] }));
  const first = await fixture.api.quoteCartShipping(cart(), "400001");
  first.amountPaise = 1;
  currentRate = 65;
  const cached = await fixture.api.quoteCartShipping(cart(), "400001");
  assert.equal(cached.amountPaise, 10500, "Cached quotes include the markup once and cannot be mutated by callers");
  assert.equal(fixture.calls.length, 1);
  const refreshed = await fixture.api.quoteCartShipping(cart(), "400001", { refresh: true });
  assert.equal(refreshed.amountPaise, 11500);
  assert.equal(fixture.calls.length, 2);
  fixture.advance(5 * 60_000);
  currentRate = 70;
  const expired = await fixture.api.quoteCartShipping(cart(), "400001");
  assert.equal(expired.amountPaise, 12000);
  assert.equal(fixture.calls.length, 3);
});

test("changing quantity, destination or subtotal cannot reuse an incompatible quote", async () => {
  const fixture = createQuoter();
  await fixture.api.quoteCartShipping(cart(), "400001");
  await fixture.api.quoteCartShipping(cart({ lines: [{ ...cart().lines[0], quantity: 75 }] }), "400001");
  await fixture.api.quoteCartShipping(cart(), "560001");
  const changedPrice = await fixture.api.quoteCartShipping(cart({ amountPaise: 60_000 }), "400001");
  assert.equal(fixture.calls.length, 4);
  assert.equal(changedPrice.totalPaise, 70_572);
});

test("invalid subtotals and totals overflowing order storage cannot become payable quotes", async () => {
  for (const amountPaise of [0, -1, 99, 100.5, NaN, Infinity, 2_147_483_648]) {
    const fixture = createQuoter();
    await assert.rejects(fixture.api.quoteCartShipping(cart({ amountPaise }), "400001"));
    assert.equal(fixture.calls.length, 0);
  }
  const fixture = createQuoter();
  await assert.rejects(fixture.api.quoteCartShipping(cart({ amountPaise: 2_147_483_647 }), "400001"), (error) => {
    assert.equal(error.code, "INVALID_TOTAL");
    return true;
  });
  const zeroRate = createQuoter(() => ({ couriers: [
    { id: 10, name: "Zero Rate Courier", rate: 0, estimatedDeliveryDays: 3 },
  ] }));
  const maximum = await zeroRate.api.quoteCartShipping(cart({ amountPaise: 2_147_478_647 }), "400001");
  assert.equal(maximum.totalPaise, 2_147_483_647);
  await assert.rejects(zeroRate.api.quoteCartShipping(cart({ amountPaise: 2_147_478_648 }), "400001"), (error) => {
    assert.equal(error.code, "INVALID_TOTAL", "The flat markup must be included in payment/storage limits");
    return true;
  });
});
