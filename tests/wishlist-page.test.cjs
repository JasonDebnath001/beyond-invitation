const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

function load(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, console, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, ...globals });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const helpers = load("lib/wishlist.ts");
const product = { slug: "card-a", name: "Ivory invitation", price: 100, mrp: 125, category: "wedding", images: ["/card.jpg"], subject: "Wedding Card", description: "", emoji: "" };

test("wishlist sorting is newest-first, leaves inputs intact, and puts unpriced designs last in both price orders", () => {
  const products = [{ ...product, slug: "old", name: "Zulu", price: 100 }, { ...product, slug: "new", name: "Alpha", price: 200 },
    { ...product, slug: "zero", price: 0 }, { ...product, slug: "invalid", price: NaN }, { ...product, slug: "negative", price: -1 }];
  const slugs = ["old", "zero", "negative", "invalid", "new"];
  const sort = key => plain(helpers.sortWishlistProducts(products, slugs, key).map(({ slug }) => slug));
  assert.deepEqual(sort("recent"), ["new", "invalid", "negative", "zero", "old"]);
  assert.deepEqual(sort("price-asc"), ["old", "new", "invalid", "negative", "zero"]);
  assert.deepEqual(sort("price-desc"), ["new", "old", "invalid", "negative", "zero"]);
  assert.deepEqual(sort("name"), ["new", "invalid", "negative", "zero", "old"]);
  assert.deepEqual(products.map(({ slug }) => slug), ["old", "new", "zero", "invalid", "negative"]);
  assert.deepEqual(slugs, ["old", "zero", "negative", "invalid", "new"]);
});

test("shared slugs trim and deduplicate, reject invalid inputs, and cap the list at forty", () => {
  for (const input of [null, undefined, 123, {}, [], "", " , , ", "a".repeat(201)]) assert.deepEqual(plain(helpers.parseSharedSlugs(input)), []);
  assert.deepEqual(plain(helpers.parseSharedSlugs(" 313082,535093,313082, ,535093 ")), ["313082", "535093"]);
  const slugs = Array.from({ length: 45 }, (_, i) => `card-${i}`);
  assert.deepEqual(plain(helpers.parseSharedSlugs(slugs.join(","))), slugs.slice(0, 40));
});

test("share URLs encode the bounded list without losing origin or including duplicate items", () => {
  assert.equal(helpers.buildWishlistShareUrl("https://shop.example/", ["313082", "535093", "313082"]), "https://shop.example/wishlist?items=313082%2C535093");
  const slugs = Array.from({ length: 45 }, (_, i) => `design ${i}`);
  const url = new URL(helpers.buildWishlistShareUrl("http://localhost:3000", slugs));
  assert.equal(url.origin, "http://localhost:3000");
  assert.deepEqual(plain(helpers.parseSharedSlugs(url.searchParams.get("items"))), slugs.slice(0, 40));
});

async function withDom(run) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000/wishlist" });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const imports = {
    react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/wishlist": helpers,
    "@/lib/product-name": load("lib/product-name.ts"),
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/image": ({ fill, ...props }) => React.createElement("img", props),
    "lucide-react": { X: () => null, ImageOff: () => null, Share2: () => null },
    "@/types": load("types/index.ts"), "@/lib/product-quantity": load("lib/product-quantity.ts"),
    "@/components/AddToCartButton": ({ product }) => React.createElement("button", null, product.price > 0 ? "Add to cart" : "Enquire for price"),
    "@/components/ProductPrice": ({ price }) => React.createElement("span", null, price > 0 ? price : "Price on request"),
    "@/components/WishlistButton": ({ productSlug }) => React.createElement("button", { "aria-label": "Add to wishlist", "data-slug": productSlug }, "Save"),
    "./product-image": load("components/wishlist/product-image.ts"),
  };
  imports["./WishlistUI"] = load("components/wishlist/WishlistUI.tsx", imports);
  const globals = { window: dom.window, document: dom.window.document, AbortController, setTimeout, clearTimeout, Error };
  const render = async element => React.act(async () => root.render(element));
  try { await run({ React, dom, root, imports, globals, render }); }
  finally { await React.act(async () => root.unmount()); dom.window.close(); delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT; }
}

test("own wishlist cards remove the correct article, shared cards render the existing heart, and broken images fall back", async () => withDom(async ({ React, dom, imports, globals, render }) => {
  const Card = load("components/wishlist/WishlistCard.tsx", imports, globals).default;
  const removed = [];
  await render(React.createElement(Card, { product, onRemove: (...args) => removed.push(args) }));
  const article = document.querySelector("article");
  assert.match(article.textContent, /Ivory invitation/);
  assert.match(article.textContent, /Min. 50 pieces/);
  await React.act(async () => document.querySelector('[aria-label="Remove from wishlist"]').click());
  assert.equal(removed[0][0], "card-a");
  assert.equal(removed[0][1], article);
  await React.act(async () => document.querySelector("img").dispatchEvent(new dom.window.Event("error")));
  assert.match(article.textContent, /Image coming soon/);
  await render(React.createElement(Card, { product: { ...product, price: 0 }, mode: "shared" }));
  assert.equal(document.querySelector('[aria-label="Remove from wishlist"]'), null);
  assert.equal(document.querySelector('[aria-label="Add to wishlist"]').dataset.slug, "card-a");
  assert.match(document.querySelector("article").textContent, /Price on request/);
  assert.match(document.querySelector("article").textContent, /Enquire for price/);
}));

test("product lookups preserve remaining card data during removals and rollback without another fetch", async () => withDom(async ({ React, imports, globals, render }) => {
  let reads = 0;
  const hook = load("components/wishlist/useWishlistProducts.ts", imports, { ...globals,
    fetch: async (_url, init) => { reads++; return { ok: true, json: async () => ({ products: JSON.parse(init.body).slugs.map(slug => ({ ...product, slug })) }) }; },
  });
  let latest;
  function Probe({ slugs }) { latest = hook.useWishlistProducts(slugs, true); return React.createElement("p", null, latest.loading ? "loading" : latest.products.map(p => p.slug).join(",")); }
  await render(React.createElement(Probe, { slugs: ["first", "second"] }));
  assert.equal(reads, 1);
  await render(React.createElement(Probe, { slugs: ["second"] }));
  assert.equal(reads, 1); assert.equal(latest.loading, false);
  assert.equal(document.querySelector("p").textContent, "second");
  await render(React.createElement(Probe, { slugs: ["first", "second"] }));
  assert.equal(reads, 1); assert.equal(latest.products.length, 2);
}));

test("remove-all waits for each account write and stops on a rollback", async () => withDom(async ({ React, imports, globals, render }) => {
  let state; let finish; let makeReady; const writes = [];
  const Context = React.createContext(null);
  imports["@/components/WishlistProvider"] = { useWishlist: () => React.useContext(Context) };
  const Unavailable = load("components/wishlist/UnavailableItems.tsx", imports, globals).default;
  function Provider() {
    const [value, setValue] = React.useState({ slugs: ["missing-a", "missing-b", "missing-c"], syncing: false, ready: false });
    state = value;
    makeReady = () => setValue(current => ({ ...current, ready: true }));
    const removeItem = slug => {
      assert.equal(value.syncing, false, "must not send overlapping writes");
      writes.push(slug); const previous = value.slugs;
      setValue({ ...value, syncing: true, slugs: value.slugs.filter(x => x !== slug) });
      finish = fail => setValue(current => ({ ...current, syncing: false, slugs: fail ? previous : current.slugs }));
    };
    return React.createElement(Context.Provider, { value: { ...value, removeItem } }, React.createElement(Unavailable, { slugs: value.slugs }));
  }
  await render(React.createElement(Provider));
  assert.deepEqual(writes, []);
  await React.act(async () => makeReady());
  await React.act(async () => [...document.querySelectorAll("button")].find(x => x.textContent === "Remove all unavailable").click());
  assert.deepEqual(writes, ["missing-a"]); assert.equal(state.syncing, true);
  await React.act(async () => finish(false));
  assert.deepEqual(writes, ["missing-a", "missing-b"]);
  await React.act(async () => finish(true));
  assert.deepEqual(writes, ["missing-a", "missing-b"]);
  assert.deepEqual(state.slugs, ["missing-b", "missing-c"]);
  assert.equal([...document.querySelectorAll("button")].find(x => x.textContent === "Remove all unavailable").disabled, false);
}));

test("sharing copies a bounded URL on desktop and uses native sharing on touch devices", async () => withDom(async ({ React, imports, globals, render }) => {
  const copied = []; const shared = [];
  const navigator = { maxTouchPoints: 0, clipboard: { writeText: async url => copied.push(url) }, share: async data => shared.push(plain(data)) };
  globals.window.matchMedia = () => ({ matches: false });
  const Toolbar = load("components/wishlist/WishlistToolbar.tsx", imports, { ...globals, navigator }).default;
  const slugs = Array.from({ length: 45 }, (_, i) => `card-${i}`);
  await render(React.createElement(Toolbar, { products: [product], slugs, sortKey: "recent", onSort() {} }));
  await React.act(async () => [...document.querySelectorAll("button")].find(x => x.textContent === "Share list").click());
  assert.equal(copied.length, 1); assert.equal(shared.length, 0);
  assert.equal(document.querySelector('[role="status"]').textContent, "Link copied (first 40 designs)");
  assert.equal(helpers.parseSharedSlugs(new URL(copied[0]).searchParams.get("items")).length, 40);
  navigator.maxTouchPoints = 1;
  await React.act(async () => document.querySelector("button").click());
  assert.equal(shared.length, 1); assert.equal(shared[0].title, "My Beyond Invitation shortlist");
  assert.equal(copied.length, 1);
}));

test("signed-in wishlist shows account storage copy without the guest nudge", async () => withDom(async ({ React, imports, globals, render }) => {
  const state = { slugs: [product.slug], ready: true, syncing: false, signedIn: true, error: "", retry() {}, removeItem() {} };
  const motion = { removeCard: (_element, commit) => commit(), reorderStart() {}, reorderEnd() {} };
  const pageImports = {
    ...imports,
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@/components/WishlistProvider": { useWishlist: () => state },
    "@/components/wishlist/WishlistMotion": { WishlistMotion: ({ children }) => children, useWishlistMotion: () => motion },
    "@/components/wishlist/WishlistUI": imports["./WishlistUI"],
    "@/components/wishlist/WishlistCard": load("components/wishlist/WishlistCard.tsx", imports, globals).default,
    "@/components/wishlist/WishlistSkeleton": load("components/wishlist/WishlistSkeleton.tsx", imports, globals).default,
    "@/components/wishlist/WishlistEmpty": load("components/wishlist/WishlistEmpty.tsx", imports, globals).default,
    "@/components/wishlist/WishlistToolbar": load("components/wishlist/WishlistToolbar.tsx", imports, globals).default,
    "@/components/wishlist/UnavailableItems": () => null,
    "@/components/wishlist/SharedShortlist": () => null,
    "@/components/wishlist/useWishlistProducts": load("components/wishlist/useWishlistProducts.ts", imports, {
      ...globals, fetch: async () => ({ ok: true, json: async () => ({ products: [product] }) }),
    }),
  };
  const Page = load("app/wishlist/page.tsx", pageImports, globals).default;
  await render(React.createElement(Page));
  assert.match(document.querySelector('[data-motion="meta"]').textContent, /1 saved design, saved to your account/);
  assert.equal(document.querySelector('[data-motion="nudge"]'), null);
  assert.match(document.querySelector("article").textContent, /Ivory invitation/);
}));
