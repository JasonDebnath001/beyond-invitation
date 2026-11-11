const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://shop.example.test/checkout/success" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

const id = "12345678-1234-1234-1234-123456789abc";
const otherId = "12345678-1234-1234-1234-123456789abd";
const token = "s".repeat(43);
const defaults = {
  react: React,
  "react/jsx-runtime": require("react/jsx-runtime"),
  "server-only": {},
  "node:crypto": require("node:crypto"),
  "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement("a", props, children) },
};
function load(filename, imports = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", filename), "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  const dependencies = { ...defaults, ...imports };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)((name) => {
    if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected test import: ${name}`);
    return dependencies[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

test("guest capabilities are random, stored as hashes, and reject malformed or different tokens", () => {
  const helpers = load("lib/order-tracking-token.ts");
  const first = helpers.createOrderTrackingToken();
  const second = helpers.createOrderTrackingToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.hash, second.hash);
  assert.equal(helpers.verifyOrderTrackingToken(first.token, first.hash), true);
  assert.equal(helpers.verifyOrderTrackingToken(second.token, first.hash), false);
  for (const value of [undefined, null, "", {}, [], "short", `${first.token}extra`]) {
    assert.equal(helpers.verifyOrderTrackingToken(value, first.hash), false);
    assert.equal(helpers.verifyOrderTrackingToken(first.token, value), false);
  }
});

test("private tracking links keep capabilities in fragments and reject arbitrary references", () => {
  const links = load("lib/order-tracking-link.ts");
  const href = links.privateTrackingLink(id, token);
  const url = new URL(href, "https://shop.example.test");
  assert.equal(url.pathname, "/track-order");
  assert.equal(url.searchParams.get("order"), id);
  assert.equal(url.search.includes(token), false);
  assert.equal(links.trackingTokenFromHash(url.hash), token);
  assert.equal(links.privateTrackingLink("https://evil.example", token), null);
  assert.equal(links.privateTrackingLink(id, "<script>"), null);
  assert.equal(links.trackingTokenFromHash("#token=short"), null);
  assert.equal(links.trackingTokenFromHash(""), null);
});

async function checkout({ verifiedOrderId = id, verifiedPaymentId = "pay_test123", responseOrderId = "order_test123", verified = true } = {}) {
  const previous = window.Razorpay;
  const requests = [];
  let options;
  window.Razorpay = function (input) {
    options = input;
    this.open = () => {};
    this.on = () => {};
  };
  const hook = load("components/useRazorpayCheckout.ts", {}, {
    fetch: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      if (url === "/api/razorpay/order") return Response.json({
        websiteOrderId: id, trackingToken: token, orderId: "order_test123", amount: 10000, currency: "INR", keyId: "rzp_test_public",
      });
      assert.equal(url, "/api/razorpay/verify");
      return Response.json({ verified, websiteOrderId: verifiedOrderId, paymentId: verifiedPaymentId, paymentPending: verifiedOrderId === null });
    },
  });
  let api;
  function Probe() { api = hook.useRazorpayCheckout(); return null; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const successes = [];
  const errors = [];
  try {
    await React.act(async () => root.render(React.createElement(Probe)));
    await React.act(async () => api.startCheckout({
      items: [{ itemCode: "TEST", quantity: 1 }], expectedAmountPaise: 10000, expectedShippingAmountPaise: 1000,
      onSuccess: (result) => successes.push(result), onError: (error) => errors.push(error),
    }));
    assert.equal(successes.length, 0, "A created payment order is not a verified payment");
    assert.equal(JSON.stringify(options).includes(token), false, "Private tracking token must not be shared with Razorpay");
    await React.act(async () => options.handler({
      razorpay_order_id: responseOrderId, razorpay_payment_id: "pay_test123", razorpay_signature: "test_signature",
    }));
    assert.equal(JSON.stringify(requests).includes(token), false, "Token is not sent to payment verification");
    return { successes, errors, requests };
  } finally {
    await React.act(async () => root.unmount());
    container.remove();
    window.Razorpay = previous;
  }
}

test("verified checkout hands its own private tracking link to the success page", async () => {
  const result = await checkout();
  assert.deepEqual(result.successes, [{ paymentId: "pay_test123", websiteOrderId: id, paymentPending: false, trackingToken: token }]);
  assert.equal(result.errors.length, 0);
});

test("a verified payment awaiting capture retains the private link for later tracking", async () => {
  const result = await checkout({ verifiedOrderId: null });
  assert.equal(result.successes[0].websiteOrderId, id);
  assert.equal(result.successes[0].trackingToken, token);
  assert.equal(result.successes[0].paymentPending, true);
});

test("mismatched or unverified payments never hand off a tracking capability", async () => {
  for (const options of [
    { verifiedOrderId: otherId }, { verifiedPaymentId: "pay_other" },
    { responseOrderId: "order_other" }, { verified: false },
  ]) {
    const result = await checkout(options);
    assert.equal(result.successes.length, 0);
    assert.equal(result.errors.length, 1);
    if (options.responseOrderId) assert.equal(result.requests.length, 1, "Mismatched checkout callbacks must not be sent for verification");
  }
});

test("confirmation provides a copyable private link without putting the token in HTTP parameters", async () => {
  window.history.replaceState(null, "", `/checkout/success?order_id=${id}#token=${token}`);
  const links = load("lib/order-tracking-link.ts");
  const hook = load("components/usePrivateTrackingToken.ts", { "@/lib/order-tracking-link": links });
  let copied;
  const component = load("components/PrivateTrackingLink.tsx", {
    "@/lib/order-tracking-link": links, "@/components/usePrivateTrackingToken": hook,
  }, { navigator: { clipboard: { writeText: async (value) => { copied = value; } } } }).default;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await React.act(async () => root.render(React.createElement(component, { orderId: id })));
    const link = container.querySelector("a");
    assert.equal(link.getAttribute("href"), `/track-order?order=${id}#token=${token}`);
    assert.equal(link.getAttribute("rel"), "noreferrer");
    assert.equal(container.textContent.includes(token), false);
    await React.act(async () => container.querySelector("button").click());
    assert.equal(copied, `https://shop.example.test/track-order?order=${id}#token=${token}`);
    assert.match(container.textContent, /Private tracking link copied/);
    assert.equal(new URL(copied).search.includes(token), false);
  } finally {
    await React.act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/checkout/success");
  }
});
