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
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

function load(file, imports = {}, globals = {}) {
  const dependencies = { react: React, "react/jsx-runtime": require("react/jsx-runtime"), ...imports };
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)((name) => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected test import: ${name}`);
    return dependencies[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

const shippingTypes = load("lib/shipping.ts");
const quantities = load("lib/product-quantity.ts");
const sampleItems = [{
  slug: "test-card", itemCode: "TEST", subject: "Wedding Card", name: "Test card", printName: "",
  price: 20, mrp: 25, image: "", emoji: "", quantity: 50, minimumQuantity: 50, quantityStep: 25,
}];
function quoteFor(body, amountPaise = 12345) {
  const subtotalPaise = body.items.reduce((sum, item) => sum + item.quantity * 2000, 0);
  return {
    pincode: body.pincode, subtotalPaise, amountPaise, totalPaise: subtotalPaise + amountPaise,
    currency: "INR", weightKg: 2.5, courierId: 1, courierName: "Test Courier",
    estimatedDeliveryDays: 3, expiresAt: Date.now() + 60_000,
  };
}

async function mount({ initialPincode = "", onQuote, checkout = false, contextOverride } = {}) {
  localStorage.clear();
  localStorage.setItem("beyond-invitation-cart-v2", JSON.stringify(sampleItems));
  if (initialPincode) localStorage.setItem("beyond-invitation-delivery-pincode", initialPincode);
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  const network = async (url, options = {}) => {
    if (url === "/api/locations/states") return Response.json({ states: ["Maharashtra"] });
    if (url.startsWith("/api/locations/cities")) return Response.json({ cities: ["Mumbai"] });
    assert.equal(url, "/api/shipping/quote", "UI tests may only use mocked endpoints");
    const body = JSON.parse(options.body);
    requests.push({ body, signal: options.signal });
    return onQuote ? onQuote(body, options.signal) : Response.json({ quote: quoteFor(body) });
  };
  const hook = load("components/useShippingQuote.ts", { "@/lib/shipping": shippingTypes }, {
    fetch: network,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  });
  const provider = load("components/CartProvider.tsx", {
    "@/lib/shipping": shippingTypes,
    "@/lib/product-quantity": quantities,
  });
  let context;
  let externalContext = contextOverride;
  function Probe() { context = provider.useCart(); return null; }
  const shared = {
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/components/CartProvider": contextOverride ? { useCart: () => externalContext } : provider,
    "@/components/useShippingQuote": hook,
    "@/components/ProductPrice": { __esModule: true, default: ({ price }) => React.createElement("span", null, `₹${price}`) },
    "@/lib/product-name": { formatProductName: (name) => name },
  };
  const CartPage = load("app/cart/page.tsx", shared).default;
  const paymentCalls = [];
  const CheckoutPage = load("app/checkout/page.tsx", {
    ...shared,
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/components/AuthProvider": { useAuth: () => ({ user: null }) },
    "@/components/useRazorpayCheckout": { useRazorpayCheckout: () => ({ startCheckout: (args) => paymentCalls.push(args), loading: false }) },
    "@/lib/shipping": shippingTypes,
  }, { fetch: network }).default;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  async function render(isCheckout = false) {
    const Page = isCheckout ? CheckoutPage : CartPage;
    await React.act(async () => root.render(React.createElement(provider.CartProvider, null,
      React.createElement(Probe), React.createElement(Page))));
  }
  await render(checkout);
  return {
    container, requests, paymentCalls, render,
    get context() { return context; },
    async setContext(value) { externalContext = value; await render(true); },
    async fill(input, value) {
      assert.ok(input, "Expected an input");
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    },
    async flush({ wait = true } = {}) {
      await React.act(async () => {
        const promises = [];
        for (const [id, timer] of [...timers]) {
          if (timer.delay > 400) continue;
          timers.delete(id);
          promises.push(timer.callback());
        }
        if (wait) await Promise.all(promises);
      });
    },
    async close() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("cart pincode persists into checkout and shipping contributes to the displayed total", async () => {
  const ui = await mount();
  try {
    assert.equal(ui.requests.length, 0);
    assert.doesNotMatch(ui.container.querySelector("aside").textContent, /Free/);
    await ui.fill(ui.container.querySelector("#cart-delivery-pincode"), "400001");
    await ui.flush();
    assert.match(ui.container.querySelector("aside").textContent, /₹123\.45/);
    assert.match(ui.container.querySelector("aside").textContent, /₹1,123\.45/);
    assert.equal(localStorage.getItem("beyond-invitation-delivery-pincode"), "400001");
    await ui.render(true);
    assert.equal(ui.container.querySelector('input[placeholder="6-digit pincode"]').value, "400001");
    const pay = [...ui.container.querySelectorAll("button")].find((button) => button.textContent === "Pay Now");
    assert.equal(pay.disabled, true, "Checkout rechecks the current quote");
    await ui.flush();
    assert.equal(pay.disabled, false);
    await ui.fill(ui.container.querySelector('input[placeholder="6-digit pincode"]'), "560001");
    assert.equal(pay.disabled, true, "Editing the address immediately disables the old quote");
    assert.doesNotMatch(ui.container.querySelector("aside").textContent, /₹123\.45/);
    await ui.flush();
    assert.equal(pay.disabled, false);
    assert.equal(ui.context.deliveryPincode, "560001");
  } finally { await ui.close(); }
});

test("a late saved pincode never overwrites a customer's checkout edit", async () => {
  const state = {
    items: sampleItems, totalItems: 50, totalPrice: 1000, clearCart() {},
    deliveryPincode: "", setDeliveryPincode() {},
  };
  const ui = await mount({ checkout: true, contextOverride: state });
  try {
    const input = ui.container.querySelector('input[placeholder="6-digit pincode"]');
    await ui.fill(input, "560001");
    await ui.setContext({ ...state, deliveryPincode: "400001" });
    assert.equal(input.value, "560001");
    await ui.flush();
    assert.equal(ui.requests.at(-1).body.pincode, "560001");
  } finally { await ui.close(); }
});

test("invalid pincodes do not query rates and quote failures can be retried", async () => {
  let unavailable = true;
  const ui = await mount({ onQuote: (body) => unavailable
    ? Response.json({ error: "Delivery is unavailable for this pincode." }, { status: 422 })
    : Response.json({ quote: quoteFor(body) }) });
  try {
    const input = ui.container.querySelector("#cart-delivery-pincode");
    await ui.fill(input, "000001");
    await React.act(async () => ui.container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    await ui.flush();
    assert.equal(ui.requests.length, 0);
    assert.match(ui.container.textContent, /valid six-digit/);
    await ui.fill(input, "400001");
    await ui.flush();
    assert.match(ui.container.textContent, /Delivery is unavailable/);
    assert.doesNotMatch(ui.container.querySelector("aside").textContent, /₹123\.45/);
    unavailable = false;
    await React.act(async () => ui.container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    await ui.flush();
    assert.match(ui.container.querySelector("aside").textContent, /₹123\.45/);
  } finally { await ui.close(); }
});

test("slow responses cannot restore stale rates after a pincode or quantity change", async () => {
  const pending = [];
  const ui = await mount({ initialPincode: "400001", onQuote: (body, signal) =>
    new Promise((resolve) => pending.push({ body, signal, resolve })) });
  try {
    await ui.flush({ wait: false });
    await ui.fill(ui.container.querySelector("#cart-delivery-pincode"), "560001");
    assert.equal(pending[0].signal.aborted, true);
    await ui.flush({ wait: false });
    await React.act(async () => pending[1].resolve(Response.json({ quote: quoteFor(pending[1].body, 23456) })));
    assert.match(ui.container.querySelector("aside").textContent, /₹234\.56/);
    await React.act(async () => pending[0].resolve(Response.json({ quote: quoteFor(pending[0].body, 12345) })));
    assert.doesNotMatch(ui.container.querySelector("aside").textContent, /₹123\.45/);
    await React.act(async () => ui.context.setQuantity("test-card", 75));
    assert.doesNotMatch(ui.container.querySelector("aside").textContent, /₹234\.56/);
    await ui.flush({ wait: false });
    assert.equal(pending[2].body.items[0].quantity, 75);
    await React.act(async () => pending[2].resolve(Response.json({ quote: quoteFor(pending[2].body, 34567) })));
    assert.match(ui.container.querySelector("aside").textContent, /₹345\.67/);
  } finally { await ui.close(); }
});

test("a changed shipping price refreshes the quote before any payment window opens", async () => {
  const previousRazorpay = window.Razorpay;
  let opened = 0;
  window.Razorpay = function () { opened++; };
  const requests = [];
  const checkout = load("components/useRazorpayCheckout.ts", {}, {
    fetch: async (url, options) => {
      assert.equal(url, "/api/razorpay/order");
      requests.push(JSON.parse(options.body));
      return Response.json({ error: "Shipping changed. Please review your updated total." }, { status: 409 });
    },
  });
  let api;
  function Probe() { api = checkout.useRazorpayCheckout(); return null; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await React.act(async () => root.render(React.createElement(Probe)));
    const errors = [];
    let refreshes = 0;
    await React.act(async () => api.startCheckout({
      items: [{ itemCode: "TEST", slug: "test-card", quantity: 50 }],
      customer: { pincode: "400001" },
      expectedAmountPaise: 112345,
      expectedShippingAmountPaise: 12345,
      onQuoteChanged: () => { refreshes++; },
      onError: (message) => errors.push(message),
    }));
    assert.equal(requests[0].expectedAmountPaise, 112345);
    assert.equal(requests[0].expectedShippingAmountPaise, 12345);
    assert.equal(requests[0].customer.pincode, "400001");
    assert.equal(opened, 0);
    assert.equal(refreshes, 1);
    assert.match(errors[0], /review your updated total/);
    assert.equal(api.loading, false);
  } finally {
    await React.act(async () => root.unmount());
    container.remove();
    window.Razorpay = previousRazorpay;
  }
});
