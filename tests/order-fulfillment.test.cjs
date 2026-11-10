const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { isDeepStrictEqual } = require("node:util");
const { randomUUID } = require("node:crypto");
const ts = require("typescript");

const orderId = "b2000000-0000-4000-8000-000000000002";
const liveKeyId = "rzp_live_test_fixture";
const parcel = { weightKg: 2.2, lengthCm: 20, breadthCm: 15, heightCm: 10 };
const reference = BigInt(`0x${orderId.replace(/-/g, "")}`).toString();

function orderSnapshot(overrides = {}) {
  const row = {
    id: orderId,
    created_at: "2026-11-10T00:00:00.000Z",
    paid_at: "2026-11-10T00:01:00.000Z",
    payment_status: "paid",
    customer_name: "Test Full Customer",
    customer_email: "customer@example.test",
    customer_phone: "+91 99999 99999",
    shipping_address: {
      addressLine1: "Saved delivery address", addressLine2: "Unit 1", city: "Mumbai", state: "Maharashtra",
      pincode: "400001", country: "India", paymentMode: "live", paymentKeyId: liveKeyId,
      shippingQuote: { pincode: "400001", subtotalPaise: 50_000, amountPaise: 5_572, totalPaise: 55_572 },
    },
    notes: "Saved order instructions",
    items: [{ itemCode: "CARD-1", name: "Wedding Invitation", quantity: 50, price: 10, weightGrams: 40 }],
    amount_paise: 55_572,
    currency: "INR",
    razorpay_order_id: "order_saved",
    razorpay_payment_id: "pay_saved",
  };
  return { ...row, ...overrides, shipping_address: { ...row.shipping_address, ...(overrides.shipping_address ?? {}) } };
}

function savedAttempt(state = "needs_review") {
  return { version: 1, state, merchantOrderId: reference, attemptId: "private-attempt-id", package: parcel, updatedAt: "2026-11-10T01:00:00.000Z" };
}

function createFixture({ row = orderSnapshot(), rows, context = { mode: "live", keyId: liveKeyId }, payment = {}, paymentError, pickupError, createError, onCreate, lookup = {}, lookupError, beforeLookup, failWriteNumber, beforeWrite } = {}) {
  const stored = new Map((rows ?? [row]).map((item) => [item.id, structuredClone(item)]));
  const calls = { payments: [], pickups: 0, creates: [], lookups: [], writes: [], selects: [] };
  const matches = (item, filters) => filters.every(([operator, key, value]) => {
    if (operator === "lt") return item[key] < value;
    if (key === "shipping_address") return isDeepStrictEqual(item[key], JSON.parse(value));
    return isDeepStrictEqual(item[key], value);
  });
  const database = {
    from: (table) => {
      assert.equal(table, "website_orders");
      let update;
      let limit = Infinity;
      const filters = [];
      const ordering = [];
      const execute = (single) => {
        if (update) {
          const number = calls.writes.length + 1;
          calls.writes.push({ update: structuredClone(update), filters: structuredClone(filters) });
          // These conditions are required for a durable claim, independently of
          // the in-memory fixture's behavior; omitting one must fail the test.
          assert.ok(filters.some(([op, key]) => op === "eq" && key === "id"));
          assert.ok(filters.some(([op, key, value]) => op === "eq" && key === "payment_status" && value === "paid"));
          assert.ok(filters.some(([op, key, value]) => op === "eq" && key === "shipping_address" && typeof value === "string"));
          if (beforeWrite) beforeWrite(number, stored);
          if (number === failWriteNumber) return { data: null, error: { message: "PRIVATE database error" } };
        } else calls.selects.push(structuredClone(filters));
        let selected = [...stored.values()].filter((item) => matches(item, filters));
        for (const [key, ascending] of [...ordering].reverse()) {
          selected.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
        }
        selected = selected.slice(0, limit);
        if (update) {
          // Mutation and predicate comparison happen together, before yielding.
          // Concurrent callers can read the same snapshot but only one can win.
          for (const item of selected) Object.assign(item, structuredClone(update));
        }
        return { data: structuredClone(single ? selected[0] ?? null : selected), error: null };
      };
      const query = {
        select: () => query,
        update: (value) => { update = value; return query; },
        eq: (key, value) => { filters.push(["eq", key, value]); return query; },
        lt: (key, value) => { filters.push(["lt", key, value]); return query; },
        order: (key, { ascending }) => { ordering.push([key, ascending]); return query; },
        limit: (value) => { limit = value; return query; },
        maybeSingle: async () => execute(true),
        then: (resolve, reject) => Promise.resolve().then(() => execute(false)).then(resolve, reject),
      };
      return query;
    },
  };
  class ShiprocketOrderError extends Error {
    constructor(code, message, outcome, httpStatus) { super(message); this.code = code; this.outcome = outcome; this.httpStatus = httpStatus; }
  }
  const imports = {
    "server-only": {},
    "node:crypto": { randomUUID },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => database },
    "@/lib/razorpay": {
      getRazorpayPaymentContext: () => {
        if (context instanceof Error) throw context;
        return context;
      },
      getRazorpay: () => ({ payments: { fetch: async (id) => {
        calls.payments.push(id);
        if (paymentError) throw paymentError;
        return {
          id: "pay_saved", order_id: "order_saved", amount: 55_572, currency: "INR",
          status: "captured", captured: true, amount_refunded: 0, ...payment,
        };
      } } }),
    },
    "@/lib/shiprocket": {
      ShiprocketOrderError,
      getShiprocketPickupLocation: async () => {
        calls.pickups++;
        if (pickupError) throw pickupError;
        return { id: 99, name: "Configured Office", pincode: "110001" };
      },
      createShiprocketOrder: async (payload) => {
        calls.creates.push(structuredClone(payload));
        assert.equal(stored.get(orderId).shipping_address.fulfillment.state, "creating", "The durable claim must precede the provider mutation");
        if (onCreate) return onCreate(payload, calls.creates.length, ShiprocketOrderError);
        if (createError) throw new ShiprocketOrderError("PROVIDER_ERROR", "PRIVATE upstream detail", createError);
        return { orderId: 321, shipmentId: 654 };
      },
      getShiprocketOrder: async (id) => {
        calls.lookups.push(id);
        if (beforeLookup) beforeLookup(id, stored);
        if (lookupError) throw lookupError;
        return { orderId: id, shipmentId: 654, merchantOrderId: reference, total: 555.72, deliveryPincode: "400001", ...lookup };
      },
    },
  };
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", "lib", "order-fulfillment.ts"), "utf8"), {
    fileName: "order-fulfillment.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
      return imports[name];
    }, loaded, loaded.exports,
  );
  return { api: loaded.exports, calls, stored, get row() { return stored.get(orderId); } };
}

function expectCode(fixture, code) {
  return (error) => {
    assert.ok(error instanceof fixture.api.FulfillmentError);
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /PRIVATE|provider-token|database-secret/);
    return true;
  };
}

test("only a paid live order using its original live Razorpay account is eligible", async () => {
  const scenarios = [
    [{ row: orderSnapshot({ payment_status: "pending" }) }, "NOT_PAID"],
    [{ row: orderSnapshot({ paid_at: null }) }, "NOT_PAID"],
    [{ row: orderSnapshot({ shipping_address: { paymentMode: "test" } }) }, "TEST_ORDER"],
    [{ row: orderSnapshot({ shipping_address: { paymentMode: undefined } }) }, "UNKNOWN_PAYMENT_MODE"],
    [{ row: orderSnapshot({ shipping_address: { paymentKeyId: "rzp_test_old" } }) }, "UNKNOWN_PAYMENT_MODE"],
    [{ context: { mode: "test", keyId: "rzp_test_current" } }, "TEST_ENVIRONMENT"],
    [{ context: { mode: "live", keyId: "rzp_live_different_account" } }, "PAYMENT_ACCOUNT_CHANGED"],
    [{ context: new Error("PRIVATE missing key") }, "PAYMENT_CONFIG"],
  ];
  for (const [options, code] of scenarios) {
    const fixture = createFixture(options);
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, code));
    assert.equal(fixture.calls.payments.length, 0);
    assert.equal(fixture.calls.pickups, 0);
    assert.equal(fixture.calls.writes.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
});

test("fresh payment verification rejects refunds, mismatched identities and incomplete capture", async () => {
  for (const payment of [
    { id: "pay_other" }, { order_id: "order_other" }, { amount: 1 }, { currency: "USD" },
    { status: "authorized" }, { captured: false }, { amount_refunded: 1 }, { amount_refunded: undefined },
    { amount_refunded: null }, { amount_refunded: false }, { amount_refunded: "" },
  ]) {
    const fixture = createFixture({ payment });
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "PAYMENT_NOT_ELIGIBLE"));
    assert.deepEqual(fixture.calls.payments, ["pay_saved"]);
    assert.equal(fixture.calls.writes.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
});

test("missing payment references and unavailable payment/pickup services cannot create shipments", async () => {
  for (const [options, code] of [
    [{ row: orderSnapshot({ razorpay_payment_id: null }) }, "PAYMENT_MISSING"],
    [{ paymentError: new Error("PRIVATE provider-token") }, "PAYMENT_UNAVAILABLE"],
    [{ pickupError: new Error("PRIVATE provider-token") }, "PICKUP_UNAVAILABLE"],
  ]) {
    const fixture = createFixture(options);
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, code));
    assert.equal(fixture.calls.writes.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
});

test("invalid package measurements and underweight parcels are rejected before external calls", async () => {
  for (const input of [null, {}, { ...parcel, weightKg: 0 }, { ...parcel, weightKg: "2.2" },
    { ...parcel, lengthCm: 0.5 }, { ...parcel, heightCm: Infinity }, { ...parcel, breadthCm: 1001 }]) {
    const fixture = createFixture();
    await assert.rejects(fixture.api.createOrderShipment(orderId, input), expectCode(fixture, "INVALID_PACKAGE"));
    assert.equal(fixture.calls.payments.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
  const fixture = createFixture();
  await assert.rejects(fixture.api.createOrderShipment(orderId, { ...parcel, weightKg: 1.9 }), expectCode(fixture, "PACKAGE_TOO_LIGHT"));
  assert.equal(fixture.calls.payments.length, 0);
});

test("saved address, item and shipping totals are validated before claiming an order", async () => {
  for (const [row, code] of [
    [orderSnapshot({ amount_paise: 1 }), "TOTAL_MISMATCH"],
    [orderSnapshot({ shipping_address: { shippingQuote: undefined } }), "TOTAL_MISMATCH"],
    [orderSnapshot({ shipping_address: { city: "" } }), "ADDRESS_INVALID"],
    [orderSnapshot({ customer_phone: "12345" }), "PHONE_INVALID"],
    [orderSnapshot({ items: [{ itemCode: "CARD-1", name: "Card", quantity: 0, price: 10 }] }), "INVALID_SNAPSHOT"],
  ]) {
    const fixture = createFixture({ row });
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, code));
    assert.equal(fixture.calls.payments.length, 0);
    assert.equal(fixture.calls.writes.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
});

test("shipment creation verifies its nonzero shipping charge and gross provider total before completing", async () => {
  const fixture = createFixture({ beforeLookup: (id, stored) => {
    assert.equal(id, 321);
    const saved = stored.get(orderId).shipping_address.fulfillment;
    assert.equal(saved.state, "needs_review", "Successful creation must be durable before read-back can fail");
    assert.equal(saved.shiprocketOrderId, 321);
    assert.equal(saved.shipmentId, 654);
  } });
  const result = await fixture.api.createOrderShipment(orderId, { ...parcel, payment_method: "COD", order_id: "forged", sub_total: 1 });
  assert.deepEqual(fixture.calls.payments, ["pay_saved"]);
  assert.equal(fixture.calls.creates.length, 1);
  const payload = fixture.calls.creates[0];
  assert.equal(payload.order_id, reference);
  assert.match(payload.order_id, /^\d{1,39}$/);
  assert.equal(payload.order_date, "2026-11-10 05:30:00");
  assert.equal(payload.pickup_location, "Configured Office");
  assert.equal(payload.billing_customer_name, "Test");
  assert.equal(payload.billing_last_name, "Full Customer");
  assert.equal(payload.billing_phone, "9999999999");
  assert.equal(payload.billing_pincode, "400001");
  assert.equal(payload.payment_method, "Prepaid");
  assert.equal(payload.sub_total, 500);
  assert.equal(payload.shipping_charges, 55.72);
  assert.deepEqual(payload.order_items, [{ name: "Wedding Invitation", sku: "CARD-1", units: 50, selling_price: 10 }]);
  assert.equal(payload.weight, parcel.weightKg);
  assert.equal(payload.length, parcel.lengthCm);
  assert.equal(payload.breadth, parcel.breadthCm);
  assert.equal(payload.height, parcel.heightCm);
  assert.equal(result.fulfillment.state, "created");
  assert.equal(result.fulfillment.shiprocketOrderId, 321);
  assert.equal(result.fulfillment.shipmentId, 654);
  assert.equal(result.canCreateShipment, false);
  assert.equal(fixture.calls.writes.length, 3);
  assert.deepEqual(fixture.calls.lookups, [321]);
  assert.deepEqual(fixture.row.shipping_address.shippingQuote, orderSnapshot().shipping_address.shippingQuote);
});

test("a repeated successful request returns the linked shipment without another provider call", async () => {
  const fixture = createFixture();
  const first = await fixture.api.createOrderShipment(orderId, parcel);
  const second = await fixture.api.createOrderShipment(orderId, parcel);
  assert.equal(second.fulfillment.shiprocketOrderId, first.fulfillment.shiprocketOrderId);
  assert.equal(fixture.calls.creates.length, 1);
  assert.equal(fixture.calls.payments.length, 1);
  assert.equal(fixture.calls.writes.length, 3);
  assert.deepEqual(fixture.calls.lookups, [321]);
});

test("a created order whose read-back differs stays locked with its known provider IDs", async () => {
  for (const lookup of [
    { total: 500 }, // Provider omitted the nonzero shipping fee from its gross total.
    { merchantOrderId: "999" },
    { deliveryPincode: "110001" },
    { shipmentId: 999 },
  ]) {
    const fixture = createFixture({ lookup });
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "SHIPMENT_MISMATCH"));
    const saved = fixture.row.shipping_address.fulfillment;
    assert.equal(saved.state, "needs_review");
    assert.equal(saved.shiprocketOrderId, 321);
    assert.equal(saved.shipmentId, 654);
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
    assert.equal(fixture.calls.creates.length, 1);
    const [listed] = await fixture.api.listFulfillmentOrders();
    assert.equal(listed.canCreateShipment, false);
    assert.equal(listed.canReconcileShipment, true);
  }
});

test("a read-back outage preserves known IDs for reconciliation and never replays creation", async () => {
  const fixture = createFixture({ lookupError: new Error("PRIVATE provider-token timeout") });
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "SHIPMENT_VERIFICATION_PENDING"));
  const saved = fixture.row.shipping_address.fulfillment;
  assert.equal(saved.state, "needs_review");
  assert.equal(saved.shiprocketOrderId, 321);
  assert.equal(saved.shipmentId, 654);
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
  assert.equal(fixture.calls.creates.length, 1);
  assert.deepEqual(fixture.calls.lookups, [321]);
});

test("concurrent attempts share a durable compare-and-set claim and only one reaches Shiprocket", async () => {
  const fixture = createFixture();
  const results = await Promise.allSettled([
    fixture.api.createOrderShipment(orderId, parcel),
    fixture.api.createOrderShipment(orderId, parcel),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failed = results.find((result) => result.status === "rejected");
  assert.ok(["ORDER_CHANGED", "RECONCILIATION_REQUIRED"].includes(failed.reason.code));
  assert.equal(fixture.calls.creates.length, 1);
  assert.equal(fixture.row.shipping_address.fulfillment.state, "created");
});

test("a failed claim or a payment-status change prevents the external write", async () => {
  for (const [options, code] of [
    [{ failWriteNumber: 1 }, "STORAGE_ERROR"],
    [{ beforeWrite: (number, stored) => { if (number === 1) stored.get(orderId).payment_status = "pending"; } }, "ORDER_CHANGED"],
  ]) {
    const fixture = createFixture(options);
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, code));
    assert.equal(fixture.calls.creates.length, 0);
    assert.equal(fixture.row.shipping_address.fulfillment, undefined);
  }
});

test("an uncertain provider result is locked for reconciliation and never retried automatically", async () => {
  for (const options of [
    { createError: "unknown" },
    { onCreate: () => { throw new Error("PRIVATE network timeout"); } },
  ]) {
    const fixture = createFixture(options);
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "SHIPROCKET_UNCERTAIN"));
    assert.equal(fixture.row.shipping_address.fulfillment.state, "needs_review");
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
    assert.equal(fixture.calls.creates.length, 1);
    assert.doesNotMatch(JSON.stringify(fixture.row.shipping_address.fulfillment), /PRIVATE/);
  }
});

test("an explicit rejection permits a deliberate retry with the same merchant reference", async () => {
  const fixture = createFixture({ onCreate: (payload, count, ErrorClass) => {
    if (count === 1) throw new ErrorClass("ORDER_REJECTED", "PRIVATE provider detail", "rejected");
    return { orderId: 321, shipmentId: 654 };
  } });
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "SHIPROCKET_REJECTED"));
  assert.equal(fixture.row.shipping_address.fulfillment.state, "failed");
  const [listed] = await fixture.api.listFulfillmentOrders();
  assert.equal(listed.canCreateShipment, true);
  const result = await fixture.api.createOrderShipment(orderId, parcel);
  assert.equal(result.fulfillment.state, "created");
  assert.equal(fixture.calls.creates.length, 2);
  assert.equal(fixture.calls.creates[0].order_id, fixture.calls.creates[1].order_id);
});

test("a successful provider write followed by a storage failure stays locked and can be reconciled", async () => {
  for (const failWriteNumber of [2, 3]) {
    const fixture = createFixture({ failWriteNumber });
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "SHIPMENT_SAVE_PENDING"));
    const saved = fixture.row.shipping_address.fulfillment;
    assert.equal(saved.state, failWriteNumber === 2 ? "creating" : "needs_review");
    if (failWriteNumber === 3) {
      assert.equal(saved.shiprocketOrderId, 321);
      assert.equal(saved.shipmentId, 654);
    }
    await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
    const result = await fixture.api.reconcileOrderShipment(orderId, 321);
    assert.equal(result.fulfillment.state, "created");
    assert.equal(result.fulfillment.shiprocketOrderId, 321);
    assert.equal(fixture.calls.creates.length, 1);
    assert.deepEqual(fixture.calls.lookups, failWriteNumber === 2 ? [321] : [321, 321]);
  }
});

test("an unknown outcome remains locked even when saving needs_review fails", async () => {
  const fixture = createFixture({ createError: "unknown", failWriteNumber: 2 });
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "STORAGE_ERROR"));
  assert.equal(fixture.row.shipping_address.fulfillment.state, "creating");
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
  assert.equal(fixture.calls.creates.length, 1);
});

test("unfamiliar persisted fulfillment states fail closed", async () => {
  const fixture = createFixture({ row: orderSnapshot({ shipping_address: { fulfillment: savedAttempt("unrecognized-state") } }) });
  const [listed] = await fixture.api.listFulfillmentOrders();
  assert.equal(listed.fulfillment.state, "needs_review");
  assert.equal(listed.canCreateShipment, false);
  await assert.rejects(fixture.api.createOrderShipment(orderId, parcel), expectCode(fixture, "RECONCILIATION_REQUIRED"));
  assert.equal(fixture.calls.creates.length, 0);
});

test("reconciliation requires the exact merchant reference, delivery pincode and total", async () => {
  for (const lookup of [{ merchantOrderId: "999" }, { deliveryPincode: "110001" }, { total: 555.71 }]) {
    const fixture = createFixture({ row: orderSnapshot({ shipping_address: { fulfillment: savedAttempt() } }), lookup });
    await assert.rejects(fixture.api.reconcileOrderShipment(orderId, 321), expectCode(fixture, "SHIPMENT_MISMATCH"));
    assert.equal(fixture.row.shipping_address.fulfillment.state, "needs_review");
    assert.equal(fixture.calls.writes.length, 0);
    assert.equal(fixture.calls.creates.length, 0);
  }
});

test("verified reconciliation links an existing order without creating a new one", async () => {
  const fixture = createFixture({ row: orderSnapshot({ shipping_address: { fulfillment: savedAttempt() } }) });
  const result = await fixture.api.reconcileOrderShipment(orderId, 321);
  assert.equal(result.fulfillment.state, "created");
  assert.equal(result.fulfillment.shiprocketOrderId, 321);
  assert.equal(result.fulfillment.shipmentId, 654);
  assert.deepEqual(fixture.calls.payments, ["pay_saved"]);
  assert.equal(fixture.calls.creates.length, 0);
  const again = await fixture.api.reconcileOrderShipment(orderId, 321);
  assert.equal(again.fulfillment.shiprocketOrderId, 321);
  assert.equal(fixture.calls.lookups.length, 1);
  await assert.rejects(fixture.api.reconcileOrderShipment(orderId, 322), expectCode(fixture, "ALREADY_LINKED"));
});

test("reconciliation rejects invalid IDs, absent attempts and failed lookups", async () => {
  const untouched = createFixture();
  await assert.rejects(untouched.api.reconcileOrderShipment(orderId, "321"), expectCode(untouched, "INVALID_SHIPROCKET_ID"));
  await assert.rejects(untouched.api.reconcileOrderShipment(orderId, 321), expectCode(untouched, "NO_ATTEMPT"));
  assert.equal(untouched.calls.lookups.length, 0);
  const failed = createFixture({ row: orderSnapshot({ shipping_address: { fulfillment: savedAttempt() } }), lookupError: new Error("PRIVATE provider-token") });
  await assert.rejects(failed.api.reconcileOrderShipment(orderId, 321), expectCode(failed, "LOOKUP_FAILED"));
  assert.equal(failed.calls.writes.length, 0);
});

test("the staff DTO reports blocked orders without exposing payment keys or private attempt metadata", async () => {
  const fixture = createFixture({ row: orderSnapshot({ shipping_address: {
    paymentMode: "test", fulfillment: { ...savedAttempt(), rawProviderResponse: "PRIVATE provider-token" },
  } }) });
  const [result] = await fixture.api.listFulfillmentOrders({ limit: 1 });
  assert.equal(result.paymentMode, "test");
  assert.equal(result.canCreateShipment, false);
  assert.equal(result.canReconcileShipment, false);
  assert.match(result.blockedReason, /Test payments/);
  assert.doesNotMatch(JSON.stringify(result), /rzp_live|paymentKeyId|private-attempt-id|PRIVATE|rawProviderResponse/);
});
