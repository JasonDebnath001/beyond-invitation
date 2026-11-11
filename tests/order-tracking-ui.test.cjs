const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://example.test/account" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

const orderId = "12345678-1234-1234-1234-123456789abc";
function fixture(overrides = {}) {
  return {
    state: "tracking", status: "In transit", courierName: "Example Courier", awb: "AWB123456789",
    trackingUrl: "https://shiprocket.co/tracking/AWB123456789", estimatedDeliveryAt: "2026-11-14T00:00:00+05:30",
    deliveredAt: null, events: [{ date: "2026-11-11T04:30:00.000Z", status: "Arrived at facility", location: "Kolkata" }],
    checkedAt: "2026-11-11T05:00:00.000Z", ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount(handler = () => Response.json({ tracking: fixture() }), initialProps = { orderId }, accountOrders) {
  const requests = [];
  const network = async (url, options = {}) => {
    assert.ok(url.startsWith("/api/account/orders/") || url === "/api/orders/tracking", "No external provider calls in UI tests");
    const request = { url, ...options };
    requests.push(request);
    return handler(request, requests.length);
  };
  const dependencies = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "lucide-react": require("lucide-react"),
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/lib/product-name": { formatProductName: (name) => name },
    "./AccountMotion": { useAccountMotion: () => ({ open() {}, close() {} }) },
    "./AccountUI": {
      secondaryClass: "secondary", linkClass: "link", focusClass: "focus", cardClass: "card",
      SectionHeading: ({ children, ...props }) => React.createElement("h2", props, children),
    },
  };
  function load(file) {
    const source = readFileSync(path.join(__dirname, "..", "components/account", file), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    const loaded = { exports: {} };
    new Function("require", "module", "exports", "fetch", outputText)((name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
      return dependencies[name];
    }, loaded, loaded.exports, network);
    return loaded.exports;
  }
  const Tracking = load("OrderTracking.tsx").default;
  dependencies["./OrderTracking"] = { __esModule: true, default: Tracking };
  const Component = accountOrders ? load("AccountOrders.tsx").default : Tracking;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Component, accountOrders ? { orders: accountOrders } : initialProps)));
  return {
    container, requests,
    async click(label = /Track order|Refresh tracking|Retry tracking/) {
      const button = [...container.querySelectorAll("button")].find((node) => label.test(node.textContent));
      assert.ok(button, `Missing button matching ${label}`);
      await React.act(async () => button.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    },
    async render(props) { await React.act(async () => root.render(React.createElement(Component, props))); },
    async close() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("tracking loads only when requested and renders courier, AWB, link and India-time activity", async () => {
  const ui = await mount();
  try {
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.container.querySelector("button").textContent, "Track order");
    await ui.click();
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.requests[0].url, `/api/account/orders/${orderId}/tracking`);
    assert.equal(ui.requests[0].cache, "no-store");
    assert.equal(ui.requests[0].credentials, "same-origin");
    assert.match(ui.container.textContent, /In transit/);
    assert.match(ui.container.textContent, /Example Courier/);
    assert.match(ui.container.textContent, /AWB123456789/);
    assert.match(ui.container.textContent, /14 Nov 2026/);
    assert.match(ui.container.querySelector("time").textContent, /10:00/);
    assert.match(ui.container.textContent, /Kolkata/);
    const link = ui.container.querySelector("a");
    assert.equal(link.href, "https://shiprocket.co/tracking/AWB123456789");
    assert.equal(link.target, "_blank");
    assert.match(link.rel, /noopener/);
  } finally { await ui.close(); }
});

test("paid order rows show tracking without expanding details, pending payments do not", async () => {
  const base = { id: orderId, reference: "Order #12345678", date: "11 Nov 2026", amount: "₹100.00", itemCount: 1, items: [], paymentReference: "" };
  const ui = await mount(undefined, undefined, [{ ...base, status: "paid" }, { ...base, id: "another-order", status: "pending" }]);
  try {
    const trackingButtons = [...ui.container.querySelectorAll("button")].filter((button) => button.textContent === "Track order");
    assert.equal(trackingButtons.length, 1);
    assert.equal(trackingButtons[0].closest("[data-order-panel]"), null);
    assert.equal(ui.requests.length, 0);
  } finally { await ui.close(); }
});

test("preparing, awaiting tracking and test orders explain their state without inventing an AWB", async () => {
  for (const [state, status, explanation] of [
    ["preparing", "Preparing your order", /Your order is being prepared/],
    ["awaiting_tracking", "Waiting for courier updates", /when the courier makes them available/],
    ["test_order", "Test order", /no live delivery to track/],
  ]) {
    const ui = await mount(() => Response.json({ tracking: fixture({ state, status, courierName: null, awb: null, trackingUrl: null, estimatedDeliveryAt: null, events: [] }) }));
    try {
      await ui.click();
      assert.match(ui.container.textContent, explanation);
      assert.doesNotMatch(ui.container.textContent, /Tracking number \(AWB\)/);
      assert.equal(ui.container.querySelector("a"), null);
      assert.equal(ui.container.querySelector("ol"), null);
    } finally { await ui.close(); }
  }
});

test("failed refresh retains prior tracking and marks it stale, with a working retry", async () => {
  const ui = await mount((_request, number) => number === 2
    ? Response.json({ error: "private provider error" }, { status: 503 })
    : Response.json({ tracking: fixture({ status: number > 2 ? "Out for delivery" : "In transit" }) }));
  try {
    await ui.click();
    await ui.click();
    assert.match(ui.container.querySelector('[role="alert"]').textContent, /may be out of date/);
    assert.match(ui.container.textContent, /In transit/);
    assert.doesNotMatch(ui.container.textContent, /private provider error/);
    await ui.click();
    assert.equal(ui.container.querySelector('[role="alert"]'), null);
    assert.match(ui.container.textContent, /Out for delivery/);
    assert.doesNotMatch(ui.container.textContent, /may be out of date/);
  } finally { await ui.close(); }
});

test("initial errors and malformed data show a safe retry, expired sessions link to sign in", async () => {
  const ui = await mount((_request, number) => number === 1 ? Response.json({}, { status: 401 })
    : number === 2 ? Response.json({ tracking: { state: "tracking", events: null } })
      : Response.json({ tracking: fixture() }));
  try {
    await ui.click();
    assert.match(ui.container.textContent, /Please sign in again/);
    assert.equal(ui.container.querySelector("a").getAttribute("href"), "/sign-in?next=%2Faccount");
    await ui.click();
    assert.match(ui.container.textContent, /couldn’t check the delivery status/);
    assert.equal(ui.container.querySelector("a"), null);
    await ui.click();
    assert.match(ui.container.textContent, /In transit/);
  } finally { await ui.close(); }
});

test("guest tracking sends its private token only in the request body", async () => {
  const token = "private-tracking-token";
  const ui = await mount(undefined, { orderId, trackingToken: token });
  try {
    assert.equal(ui.requests.length, 0);
    await ui.click();
    assert.equal(ui.requests[0].url, "/api/orders/tracking");
    assert.equal(ui.requests[0].method, "POST");
    assert.deepEqual(JSON.parse(ui.requests[0].body), { orderId, token });
    assert.equal(ui.requests[0].headers["Content-Type"], "application/json");
    assert.ok(!ui.container.innerHTML.includes(token));
  } finally { await ui.close(); }
});

test("tracking links reject hostile URLs and delivery completion replaces the estimate", async () => {
  for (const trackingUrl of ["javascript:alert(1)", "https://shiprocket.co.evil.test/123", "https://secret@shiprocket.co/123", "http://shiprocket.co/123"]) {
    const ui = await mount(() => Response.json({ tracking: fixture({ trackingUrl, deliveredAt: "2026-11-13T06:30:00Z", status: "Delivered" }) }));
    try {
      await ui.click();
      assert.equal(ui.container.querySelector("a"), null);
      assert.match(ui.container.textContent, /Delivered/);
      assert.match(ui.container.textContent, /13 Nov 2026/);
      assert.doesNotMatch(ui.container.textContent, /Estimated delivery/);
    } finally { await ui.close(); }
  }
});

test("duplicate clicks share one request and changing the order ignores an old response", async () => {
  const pending = deferred();
  const ui = await mount(() => pending.promise);
  try {
    const button = ui.container.querySelector("button");
    await React.act(async () => {
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(ui.requests.length, 1);
    assert.equal(button.disabled, true);
    assert.match(ui.container.querySelector('[role="status"]').textContent, /Checking/);
    await ui.render({ orderId: "a-new-order" });
    assert.equal(ui.requests[0].signal.aborted, true);
    await React.act(async () => pending.resolve(Response.json({ tracking: fixture() })));
    assert.doesNotMatch(ui.container.textContent, /AWB123456789/);
    assert.equal(ui.container.querySelector("button").textContent, "Track order");
  } finally { await ui.close(); }
});
