const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const test = require("node:test");
const ts = require("typescript");
const { NextResponse, NextRequest } = require("next/server");

function load(file, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, process: { env: {} },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  return exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const wishlist = load("lib/wishlist.ts");
const product = { slug: "313082", name: "313082 Invitation", price: 90, images: [], subject: "Wedding Card" };
const request = (body) => new Request("http://localhost/api/wishlist/products", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

test("saved wishlist recovers from corrupt storage and normalizes duplicate or invalid slugs", () => {
  assert.deepEqual(plain(wishlist.parseWishlist("broken json")), []);
  assert.deepEqual(plain(wishlist.parseWishlist('{"slug":"313082"}')), []);
  assert.deepEqual(plain(wishlist.parseWishlist('["313082",null,5,""," 313082 ","535093"]')), ["313082", "535093"]);
});

test("public wishlist resolves current catalogue data and rejects invalid requests without accessing the catalogue", async () => {
  let reads = 0;
  const route = load("app/api/wishlist/products/route.ts", {
    "next/server": { NextResponse },
    "@/lib/wishlist": wishlist,
    "@/lib/catalog": { getCatalogProducts: async () => { reads++; return [product]; } },
  });
  for (const body of [{}, null, { slugs: [123] }, { slugs: [""] }, { slugs: Array(501).fill("313082") }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(reads, 0);
  assert.deepEqual(await (await route.POST(request({ slugs: [] }))).json(), { products: [] });
  assert.equal(reads, 0);
  const response = await route.POST(request({ slugs: ["313082", "missing", "313082"], price: 1 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { products: [product] });
  assert.equal(reads, 1);
});

test("wishlist catalogue failures return an error rather than a false empty wishlist", async () => {
  const route = load("app/api/wishlist/products/route.ts", {
    "next/server": { NextResponse }, "@/lib/wishlist": wishlist,
    "@/lib/catalog": { getCatalogProducts: async () => { throw new Error("offline"); } },
  }, { console: { error() {} } });
  assert.equal((await route.POST(request({ slugs: ["313082"] }))).status, 503);
});

test("wishlist hearts, count and page stay in sync, persist after remount and respond to another tab", async () => {
  const { JSDOM } = require("jsdom");
  const React = require("react");
  const { act } = React;
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require("react-dom/client");
  const route = load("app/api/wishlist/products/route.ts", {
    "next/server": { NextResponse }, "@/lib/wishlist": wishlist,
    "@/lib/catalog": { getCatalogProducts: async () => [product] },
  });
  const globals = {
    window: dom.window, localStorage: dom.window.localStorage, AbortController,
    fetch: async (_url, init) => route.POST(request(JSON.parse(init.body))),
  };
  const imports = { react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/wishlist": wishlist,
    "./AuthProvider": { useAuth: () => ({ user: null, ready: true }) } };
  const provider = load("components/WishlistProvider.tsx", imports, globals);
  const Button = load("components/WishlistButton.tsx", { ...imports, "./WishlistProvider": provider }, globals).default;
  const Link = ({ children, ...props }) => React.createElement("a", props, children);
  const Nav = load("components/WishlistNavLink.tsx", { ...imports, "./WishlistProvider": provider, "next/link": Link }, globals).default;
  const Page = load("app/wishlist/page.tsx", {
    ...imports, "next/link": Link, "@/components/WishlistProvider": provider,
    "@/components/ProductCard": ({ product }) => React.createElement("article", null, product.name, React.createElement(Button, { productSlug: product.slug })),
  }, globals).default;
  let root;
  const render = async () => {
    root = createRoot(document.getElementById("root"));
    await act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(provider.WishlistProvider, null,
        React.createElement(Button, { productSlug: "313082" }), React.createElement(Nav), React.createElement(Page)),
    )));
  };
  const click = async () => act(async () => document.querySelector("button").click());
  try {
    dom.window.localStorage.setItem(wishlist.WISHLIST_STORAGE_KEY, '["313082"]');
    await render();
    assert.equal(document.querySelectorAll('button[aria-label="Remove from wishlist"]').length, 2);
    assert.ok(document.querySelector('a[aria-label="Wishlist, 1 items"]'));
    assert.match(document.querySelector("article").textContent, /313082 Invitation/);
    await click();
    assert.match(document.querySelector("main").textContent, /Your wishlist is empty/);
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), "[]");
    await click();
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), '["313082"]');
    await act(async () => root.unmount());
    await render();
    assert.equal(document.querySelectorAll('button[aria-label="Remove from wishlist"]').length, 2);
    await act(async () => {
      dom.window.localStorage.removeItem(wishlist.WISHLIST_STORAGE_KEY);
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: wishlist.WISHLIST_STORAGE_KEY, newValue: null }));
    });
    assert.match(document.querySelector("main").textContent, /Your wishlist is empty/);
    assert.ok(document.querySelector('a[aria-label="Wishlist"]'));
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("guest payment verification still requires a valid HMAC before fulfilment", async () => {
  const secret = "test-only-payment-secret";
  const razorpay = load("lib/razorpay.ts", { razorpay: class {}, crypto }, {
    process: { env: { RAZORPAY_KEY_SECRET: secret } }, Buffer,
  });
  let fulfilled = 0;
  const route = load("app/api/razorpay/verify/route.ts", {
    "next/server": { NextResponse }, "@/lib/razorpay": razorpay,
    "@/lib/website-orders": {
      InvalidOrderPaymentError: class extends Error {},
      confirmWebsiteOrderPayment: async () => { fulfilled++; return { id: "TEST-ORDER", paymentStatus: "paid" }; },
    },
  });
  const payment = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: "invalid" };
  assert.equal((await route.POST(request({}))).status, 400);
  assert.equal((await route.POST(request({ ...payment, razorpay_signature: 123 }))).status, 400);
  assert.equal((await route.POST(request(payment))).status, 400);
  assert.equal(fulfilled, 0);
  payment.razorpay_signature = crypto.createHmac("sha256", secret).update("order_test|pay_test").digest("hex");
  const response = await route.POST(request(payment));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verified, true);
  assert.equal(fulfilled, 1);
});

test("reseller account endpoints cannot read or modify private profiles without authentication", async () => {
  const route = load("app/api/reseller/route.ts", { "next/server": { NextResponse } });
  for (const method of ["GET", "POST", "PATCH"]) assert.equal((await route[method]()).status, 410);
});

test("guest middleware allows checkout and retains referral cookie handling", async () => {
  const { middleware } = load("middleware.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/session": { refreshAuthSession: async () => NextResponse.next() },
  });
  assert.equal((await middleware(new NextRequest("http://localhost/checkout"))).headers.get("x-middleware-next"), "1");
  const response = await middleware(new NextRequest("http://localhost/catalog?via=abcd1234&q=box"));
  assert.equal(response.headers.get("location"), "http://localhost/catalog?q=box");
  assert.equal(response.cookies.get("bi_pref").value, "ABCD1234");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
});
