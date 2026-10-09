const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

function loader(overrides = {}, globals = {}) {
  const modules = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "..", file);
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText;
    const scope = {
      exports, URL, Request, Response, Headers, AbortController, console,
      setTimeout, clearTimeout, ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === "server-only") return {};
        if (name.startsWith("@/") || name.startsWith("./")) {
          const target = name.startsWith("@/")
            ? path.resolve(__dirname, "..", name.slice(2))
            : path.resolve(path.dirname(filename), name);
          return load(`${target}.${fs.existsSync(`${target}.ts`) ? "ts" : "tsx"}`);
        }
        return require(name);
      },
    };
    vm.runInThisContext(`(function(${Object.keys(scope).join(",")}) {\n${code}\n})`, { filename })(...Object.values(scope));
    return exports;
  }
  return load;
}

const product = (slug, extra = {}) => ({
  slug, name: `Card ${slug}`, price: 80, mrp: 100, images: [], emoji: "",
  category: "wedding", description: "", ...extra,
});

test("catalogue pagination prices only the requested ten products and reports the last page", async () => {
  const base = Array.from({ length: 23 }, (_, i) => product(`card-${i}`));
  const pricedBatches = [];
  const { fetchErpProductPage } = loader({
    react: { cache: (fn) => fn },
    "next/cache": { unstable_cache: () => async () => base },
    "isomorphic-dompurify": { sanitize: (value) => value },
    "@/lib/supabase/server": {},
    "@/lib/catalog-pricing": {},
    "@/lib/catalog-titles": {},
    "@/lib/reseller": {
      async applyResellerPricingToProducts(rows) {
        pricedBatches.push(rows.map(({ slug }) => slug));
        return rows.map((row) => ({ ...row, price: row.price + 7 }));
      },
    },
  })("lib/catalog.ts");
  for (const [offset, count, nextOffset] of [[0, 10, 10], [10, 10, 20], [20, 3, null], [23, 0, null]]) {
    const result = offset === 0 ? await fetchErpProductPage() : await fetchErpProductPage(offset);
    assert.equal(result.products.length, count);
    assert.equal(result.nextOffset, nextOffset);
    assert.deepEqual(result.products.map(({ slug }) => slug), base.slice(offset, offset + count).map(({ slug }) => slug));
    assert.ok(result.products.every(({ price }) => price === 87));
  }
  assert.deepEqual(pricedBatches.filter((batch) => batch.length).map((batch) => batch.length), [10, 10, 3]);
  assert.ok(base.every(({ price }) => price === 80), "visitor pricing must leave the shared base catalogue untouched");
});

test("the product page API validates offsets and keeps visitor-specific responses out of shared caches", async () => {
  const offsets = [];
  let failure = false;
  const expected = { products: [product("reseller", { price: 92 })], nextOffset: null };
  const { GET } = loader({
    "@/lib/catalog": { async fetchErpProductPage(offset) {
      offsets.push(offset);
      if (failure) throw new Error("private-database-connection-details");
      return expected;
    } },
  }, { console: { error() {} } })("app/api/catalog/products/route.ts");
  const request = (query = "") => GET(new Request(`https://shop.test/api/catalog/products${query}`));
  const assertPrivate = (response) => {
    assert.match(response.headers.get("cache-control"), /private/i);
    assert.match(response.headers.get("cache-control"), /no-store/i);
  };
  for (const [query, offset] of [["", 0], ["?offset=10", 10], ["?offset=0", 0]]) {
    const response = await request(query);
    assert.equal(response.status, 200);
    assertPrivate(response);
    assert.deepEqual(await response.json(), expected);
    assert.equal(offsets.at(-1), offset);
  }
  for (const invalid of ["", "-1", "1.5", "1e2", "NaN", "Infinity", "9007199254740992", " 10 "]) {
    const response = await request(`?offset=${encodeURIComponent(invalid)}`);
    assert.equal(response.status, 400, `reject offset ${JSON.stringify(invalid)}`);
    assertPrivate(response);
  }
  assert.deepEqual(offsets, [0, 10, 0], "invalid offsets must not query the catalogue");
  failure = true;
  const response = await request("?offset=20");
  assert.equal(response.status, 503);
  assertPrivate(response);
  const error = await response.json();
  assert.equal(typeof error.error, "string");
  assert.doesNotMatch(JSON.stringify(error), /private-database/);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function withSection(run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://shop.test" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const pending = [];
  const { ProductSection } = loader({
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "./ProductCard": ({ product: row }) => React.createElement("article", {
      "data-slug": row.slug, "data-sale": String(Boolean(row.onSale)),
    }, row.name),
  }, {
    fetch(url, options) {
      const request = { ...deferred(), url, options };
      pending.push(request);
      return request.promise;
    },
  })("components/ProductGrid.tsx");
  const { createRoot } = require("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const props = { label: "Collection", title: "Cards", products: [product("first")], nextOffset: 10 };
  const render = (extra = {}) => React.act(async () => root.render(React.createElement(ProductSection, { ...props, ...extra })));
  const button = () => document.querySelector("button");
  const cards = () => [...document.querySelectorAll("article")].map((element) => ({
    slug: element.dataset.slug, sale: element.dataset.sale === "true",
  }));
  const click = () => React.act(async () => button().click());
  const respond = (index, body, status = 200) => React.act(async () => pending[index].resolve({
    ok: status >= 200 && status < 300, status, json: async () => body,
  }));
  try {
    await run({ render, pending, button, cards, click, respond, document });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("Load More waits for a click, prevents overlapping requests, deduplicates products, and ends at the final page", () => withSection(async ({ render, pending, button, cards, click, respond }) => {
  await render();
  assert.equal(pending.length, 0);
  assert.deepEqual(cards().map(({ slug }) => slug), ["first"]);
  await React.act(async () => { button().click(); button().click(); });
  assert.equal(pending.length, 1);
  assert.equal(button().disabled, true);
  assert.equal(pending[0].url, "/api/catalog/products?offset=10");
  assert.equal(pending[0].options.credentials, "same-origin");
  assert.equal(pending[0].options.cache, "no-store");
  await respond(0, { products: [product("first"), product("second"), product("second")], nextOffset: 20 });
  assert.deepEqual(cards().map(({ slug }) => slug), ["first", "second"]);
  assert.equal(button().disabled, false);
  await click();
  assert.equal(pending[1].url, "/api/catalog/products?offset=20");
  await respond(1, { products: [product("last")], nextOffset: null });
  assert.deepEqual(cards().map(({ slug }) => slug), ["first", "second", "last"]);
  assert.equal(button(), null);
}));

test("a failed page preserves existing products and retries the same offset", () => withSection(async ({ render, pending, button, cards, click, respond, document }) => {
  await render();
  await click();
  await respond(0, { error: "Catalogue unavailable" }, 503);
  assert.deepEqual(cards().map(({ slug }) => slug), ["first"]);
  assert.ok(document.querySelector('[role="alert"]')?.textContent.trim());
  assert.equal(button().disabled, false);
  await click();
  assert.equal(pending[1].url, pending[0].url);
  await respond(1, { products: [product("second")], nextOffset: null });
  assert.deepEqual(cards().map(({ slug }) => slug), ["first", "second"]);
  assert.equal(document.querySelector('[role="alert"]'), null);
}));

test("sale sections derive sale badges from prices on both initial and subsequent pages", () => withSection(async ({ render, cards, click, respond }) => {
  await render({ sale: true, products: [product("discount"), product("unpriced", { price: 0 })] });
  assert.deepEqual(cards(), [{ slug: "discount", sale: true }, { slug: "unpriced", sale: false }]);
  await click();
  await respond(0, { products: [product("new-discount"), product("full-price", { price: 100 }), product("over-mrp", { price: 110 })], nextOffset: null });
  assert.deepEqual(cards(), [
    { slug: "discount", sale: true }, { slug: "unpriced", sale: false },
    { slug: "new-discount", sale: true }, { slug: "full-price", sale: false },
    { slug: "over-mrp", sale: false },
  ]);
}));

test("new initial props abort an old request and its late response cannot enter the replacement collection", () => withSection(async ({ render, pending, button, cards, click, respond }) => {
  await render();
  await click();
  const signal = pending[0].options.signal;
  assert.equal(signal.aborted, false);
  await render({ products: [product("replacement")], nextOffset: 40 });
  assert.equal(signal.aborted, true);
  assert.equal(button().disabled, false);
  await respond(0, { products: [product("stale")], nextOffset: null });
  assert.deepEqual(cards().map(({ slug }) => slug), ["replacement"]);
  await click();
  assert.equal(pending[1].url, "/api/catalog/products?offset=40");
  await respond(1, { products: [product("replacement-last")], nextOffset: null });
  assert.deepEqual(cards().map(({ slug }) => slug), ["replacement", "replacement-last"]);
}));
