const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

function fixture(overrides = {}) {
  return {
    id: "12345678-1234-1234-1234-123456789abc", createdAt: "2026-11-10T04:30:00.000Z", paidAt: "2026-11-10T04:31:00.000Z",
    paymentStatus: "paid", paymentMode: "live", amountPaise: 112345, currency: "INR",
    customer: { name: "Example Buyer", email: "buyer@example.test", phone: "9999999999" },
    address: { addressLine1: "Example address", addressLine2: "", city: "Mumbai", state: "Maharashtra", pincode: "400001", country: "India" },
    notes: "", items: [{ itemCode: "TEST", name: "Test card", quantity: 50, price: 20 }], shippingAmountPaise: 12345,
    fulfillment: { state: "not_created", merchantOrderId: "123456789", package: null, shiprocketOrderId: null, shipmentId: null, updatedAt: null, error: null },
    canCreateShipment: true, canReconcileShipment: false, blockedReason: null,
    ...overrides,
  };
}

async function mount(initialOrder = fixture(), { onMutation, accessError } = {}) {
  let order = initialOrder;
  const requests = [];
  const network = async (url, options = {}) => {
    assert.ok(url.startsWith("/api/admin/orders"), "Only mocked staff endpoints may be called");
    requests.push({ url, method: options.method || "GET", body: options.body && JSON.parse(options.body) });
    if (!options.method || options.method === "GET") return Response.json({ orders: [order] });
    if (onMutation) return onMutation(url, JSON.parse(options.body), (updated) => { order = updated; });
    const packed = JSON.parse(options.body).package;
    order = { ...order, canCreateShipment: false, fulfillment: {
      ...order.fulfillment, state: "created", package: packed, shiprocketOrderId: 54321, shipmentId: 67890,
    } };
    return Response.json({ order });
  };
  const css = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
  const dependencies = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "lucide-react": require("lucide-react"),
    "next/image": { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "./ItemDashboard.module.css": css,
    "./OrderShipping.module.css": css,
  };
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", "components/admin/OrderShippingDashboard.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", outputText)((name) => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected test import: ${name}`);
    return dependencies[name];
  }, module, module.exports, network);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(module.exports.default, { accessError })));
  return {
    container, requests,
    async fillMeasurements(values = ["2.5", "30", "20", "10"]) {
      const inputs = container.querySelectorAll('input[type="number"]');
      assert.equal(inputs.length, 4);
      await React.act(async () => {
        inputs.forEach((input, index) => {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, values[index]);
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        });
      });
    },
    async submitTwice() {
      const form = container.querySelector("form.packageForm");
      assert.ok(form);
      await React.act(async () => {
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      });
    },
    async close() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("test payments are visibly blocked and parcel measurements have no invented defaults", async () => {
  const ui = await mount(fixture({ paymentMode: "test", canCreateShipment: false, blockedReason: "Test payments cannot create live Shiprocket shipments." }));
  try {
    assert.match(ui.container.textContent, /Test payment/);
    assert.match(ui.container.textContent, /Test payments cannot create live/);
    assert.equal(ui.container.querySelector('button[type="submit"]').disabled, true);
    assert.deepEqual([...ui.container.querySelectorAll('input[type="number"]')].map((input) => input.value), ["", "", "", ""]);
    await ui.submitTwice();
    assert.equal(ui.requests.filter((request) => request.method === "POST").length, 0);
  } finally { await ui.close(); }
});

test("staff must supply measurements and a double submit creates only one shipping request", async () => {
  const ui = await mount();
  try {
    await ui.submitTwice();
    assert.match(ui.container.textContent, /Enter the measured weight/);
    assert.equal(ui.requests.filter((request) => request.method === "POST").length, 0);
    await ui.fillMeasurements();
    await ui.submitTwice();
    const writes = ui.requests.filter((request) => request.method === "POST");
    assert.equal(writes.length, 1);
    assert.ok(writes[0].url.endsWith("/shipping"));
    assert.deepEqual(writes[0].body, { package: { weightKg: 2.5, lengthCm: 30, breadthCm: 20, heightCm: 10 } });
    assert.match(ui.container.textContent, /54321/);
    assert.match(ui.container.textContent, /67890/);
    assert.equal(ui.container.querySelector("form.packageForm"), null);
  } finally { await ui.close(); }
});

test("uncertain outcomes offer verification instead of another creation", async () => {
  const base = fixture();
  const ui = await mount({ ...base, canCreateShipment: false, canReconcileShipment: true,
    fulfillment: { ...base.fulfillment, state: "needs_review", package: { weightKg: 2.5, lengthCm: 30, breadthCm: 20, heightCm: 10 } },
    blockedReason: "Check the existing order in Shiprocket before continuing.",
  });
  try {
    assert.equal(ui.container.querySelector("form.packageForm button").disabled, true);
    assert.match(ui.container.textContent, /Verify and link existing order/);
    assert.match(ui.container.textContent, /123456789/);
    assert.equal(ui.requests.filter((request) => request.method === "POST").length, 0);
  } finally { await ui.close(); }
});

test("an access error never requests or displays order data", async () => {
  const ui = await mount(fixture(), { accessError: "Staff access is required." });
  try {
    assert.equal(ui.requests.length, 0);
    assert.match(ui.container.textContent, /Staff access required/);
    assert.doesNotMatch(ui.container.textContent, /Example Buyer|buyer@example/);
  } finally { await ui.close(); }
});

test("search and mode filters hide excluded order actions, with dates shown in India time", async () => {
  const ui = await mount();
  try {
    assert.match(ui.container.querySelector('[aria-label="Selected order"]').textContent, /10:00/);
    assert.match(ui.container.textContent, /customer’s payment stays unchanged/);
    const search = ui.container.querySelector('input[aria-label="Search orders"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search, "not-a-matching-order");
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    assert.equal(ui.container.querySelector('[aria-label="Selected order"]'), null);
    assert.equal(ui.container.querySelector("form.packageForm"), null);
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search, "");
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    assert.ok(ui.container.querySelector('[aria-label="Selected order"]'));
    const mode = ui.container.querySelector("select");
    await React.act(async () => {
      mode.value = "test";
      mode.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(ui.container.querySelector('[aria-label="Selected order"]'), null);
    assert.equal(ui.container.querySelector("form.packageForm"), null);
    assert.equal(ui.requests.filter((request) => request.method === "POST").length, 0);
  } finally { await ui.close(); }
});
