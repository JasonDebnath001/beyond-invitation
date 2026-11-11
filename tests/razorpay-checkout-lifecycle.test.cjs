const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

const orderResponse = { keyId: "rzp_test_fixture", orderId: "order_fixture", websiteOrderId: "website_fixture", amount: 112345, currency: "INR" };
const checkoutArgs = {
  items: [{ itemCode: "TEST", quantity: 50 }],
  expectedAmountPaise: 112345, expectedShippingAmountPaise: 12345,
  service: "quick", deliveryLocation: { latitude: 19.076, longitude: 72.8777 },
};

async function mount(network, { scriptReady = true } = {}) {
  for (const script of document.querySelectorAll("script")) script.remove();
  const calls = { opened: 0, success: 0, error: 0, dismiss: 0 };
  let options;
  const events = {};
  window.Razorpay = scriptReady ? function (args) {
    options = args;
    this.on = (event, callback) => { events[event] = callback; };
    this.open = () => { calls.opened++; };
  } : undefined;
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", "components/useRazorpayCheckout.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", outputText)((name) => {
    assert.equal(name, "react"); return React;
  }, module, module.exports, network);
  let api;
  function Probe() { api = module.exports.useRazorpayCheckout(); return null; }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Probe)));
  let unmounted = false;
  return {
    calls, events,
    get options() { return options; },
    start() { return api.startCheckout({ ...checkoutArgs, onSuccess: () => calls.success++, onError: () => calls.error++, onDismiss: () => calls.dismiss++ }); },
    async close() { if (!unmounted) { unmounted = true; await React.act(async () => root.unmount()); container.remove(); } },
  };
}

test("leaving checkout during script loading prevents order creation and late payment UI", async () => {
  let requested = 0;
  const ui = await mount(async () => { requested++; return Response.json(orderResponse); }, { scriptReady: false });
  let started;
  try {
    await React.act(async () => { started = ui.start(); });
    const script = document.querySelector("script");
    assert.ok(script, "Only a script element is created; no external script is loaded by jsdom");
    await ui.close();
    script.onload();
    await started;
    assert.equal(requested, 0);
    assert.deepEqual(ui.calls, { opened: 0, success: 0, error: 0, dismiss: 0 });
  } finally { await ui.close(); }
});

test("leaving checkout aborts the pending order request and ignores its late response", async () => {
  let resolveOrder;
  let signal;
  const ui = await mount(async (url, options) => {
    assert.equal(url, "/api/razorpay/order");
    signal = options.signal;
    return new Promise((resolve) => { resolveOrder = resolve; });
  });
  let started;
  try {
    await React.act(async () => { started = ui.start(); });
    assert.equal(signal.aborted, false);
    await ui.close();
    assert.equal(signal.aborted, true);
    resolveOrder(Response.json(orderResponse));
    await started;
    assert.deepEqual(ui.calls, { opened: 0, success: 0, error: 0, dismiss: 0 });
  } finally { await ui.close(); }
});

test("completed payments are verified after navigation without clearing a newer cart or redirecting", async () => {
  const requests = [];
  let verifySignal;
  const ui = await mount(async (url, options) => {
    requests.push(url);
    if (url === "/api/razorpay/order") return Response.json(orderResponse);
    assert.equal(url, "/api/razorpay/verify");
    verifySignal = options.signal;
    return Response.json({ verified: true, paymentId: "pay_fixture", websiteOrderId: "website_fixture" });
  });
  try {
    await React.act(async () => ui.start());
    assert.equal(ui.calls.opened, 1);
    await ui.close();
    await ui.options.handler({ razorpay_order_id: "order_fixture", razorpay_payment_id: "pay_fixture", razorpay_signature: "fixture" });
    ui.options.modal.ondismiss();
    ui.events["payment.failed"]({ error: { description: "fixture" } });
    assert.deepEqual(requests, ["/api/razorpay/order", "/api/razorpay/verify"]);
    assert.equal(verifySignal, undefined, "Completed payment verification is not cancelled with checkout initialization");
    assert.deepEqual(ui.calls, { opened: 1, success: 0, error: 0, dismiss: 0 });
  } finally { await ui.close(); }
});
