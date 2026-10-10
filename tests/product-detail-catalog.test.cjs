const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const row = (slug, extra = {}) => ({
  id: `id-${slug}`, slug, name: `Print ${slug}`, design_no: slug,
  description: "Product description", price: 500, mrp: 600,
  images: [`https://photos.test/${slug}_2.png`, `https://photos.test/${slug}_1.png`],
  subject: "Wedding Card", updated_at: "2026-10-01T12:00:00Z", ...extra,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture(rows, options = {}) {
  const state = {
    margin: 0, publicError: null, priceError: null, titleError: null,
    hiddenIds: new Set(), requests: [], pricingBatches: [], titleBatches: [],
    resellerProducts: [], resellerBatches: [], cacheDefinitions: [],
  };
  let requestCache = new Map();
  const publicDb = {
    from(table) {
      assert.equal(table, "v_web_products", "Only the public catalogue view may admit products");
      const query = { table, equals: [] };
      state.requests.push(query);
      return {
        select(columns) { assert.equal(columns, "*"); return this; },
        eq(field, value) { query.equals.push([field, value]); return this; },
        limit(limit) { query.limit = limit; return this; },
        order() { return this; },
        range(from, to) { query.range = [from, to]; return this; },
        async returns() {
          if (state.publicError) return { data: null, error: { message: state.publicError } };
          let data = rows.filter((item) => query.equals.every(([key, value]) => item[key] === value));
          if (query.range) data = data.slice(query.range[0], query.range[1] + 1);
          if (query.limit !== undefined) data = data.slice(0, query.limit);
          return { data, error: null };
        },
      };
    },
  };
  const overrides = {
    "server-only": {},
    react: {
      cache(fn) {
        const identifier = Symbol();
        return (...args) => {
          if (!requestCache.has(identifier)) requestCache.set(identifier, new Map());
          const entries = requestCache.get(identifier);
          const key = JSON.stringify(args);
          if (!entries.has(key)) entries.set(key, fn(...args));
          return entries.get(key);
        };
      },
    },
    "next/cache": {
      unstable_cache(fn, keys, config) {
        const entries = new Map();
        state.cacheDefinitions.push({ keys: plain(keys), config: plain(config), entries });
        return (...args) => {
          const key = JSON.stringify(args);
          if (!entries.has(key)) {
            entries.set(key, fn(...args).catch((error) => { entries.delete(key); throw error; }));
          }
          return entries.get(key);
        };
      },
    },
    "isomorphic-dompurify": { sanitize: (value) => value },
    "@/lib/product-page": { PRODUCTS_PER_PAGE: 10 },
    "@/lib/supabase/server": { getSupabaseServerClient: () => publicDb },
    "@/lib/catalog-pricing": {
      async applySellingPrices(input) {
        state.pricingBatches.push(input.map(({ id }) => id));
        if (state.priceError) throw new Error(state.priceError);
        return input.filter(({ id }) => !state.hiddenIds.has(id)).map((item) => ({
          ...item, price: options.prices?.[item.id] ?? 80, mrp: 150,
        }));
      },
    },
    "@/lib/catalog-titles": {
      async applyCatalogTitles(input) {
        state.titleBatches.push(input.map(({ id }) => id));
        if (state.titleError) throw new Error(state.titleError);
        return input.map((item) => ({ ...item, name: options.titles?.[item.id]?.trim() || item.name }));
      },
    },
    "@/lib/reseller": {
      async applyResellerPricingToProduct(product) {
        state.resellerProducts.push(product?.slug ?? null);
        return product ? { ...product, price: product.price + state.margin } : null;
      },
      async applyResellerPricingToProducts(products) {
        state.resellerBatches.push(products.map(({ slug }) => slug));
        return products.map((product) => ({ ...product, price: product.price + state.margin }));
      },
    },
  };
  const exported = {};
  const source = fs.readFileSync(path.resolve(__dirname, "../lib/catalog.ts"), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports: exported,
    require(name) { assert.ok(name in overrides, `Unexpected import: ${name}`); return overrides[name]; },
  });
  return { ...exported, state, nextRequest() { requestCache = new Map(); } };
}

test("a cold detail lookup only resolves the requested published product with Selling price and Web Title", async () => {
  const f = fixture([row("first"), row("selected"), row("last")], {
    prices: { "id-selected": 99.5 }, titles: { "id-selected": "  Ivory Wedding Invitation  " },
  });
  const product = await f.fetchErpProductBySlug("selected");
  assert.equal(product.slug, "selected");
  assert.equal(product.name, "Ivory Wedding Invitation");
  assert.equal(product.price, 99.5);
  assert.equal(product.mrp, 150);
  assert.deepEqual(plain(product.images), ["https://photos.test/selected_1.png", "https://photos.test/selected_2.png"]);
  assert.deepEqual(f.state.requests, [{ table: "v_web_products", equals: [["slug", "selected"]], limit: 1 }]);
  assert.deepEqual(plain(f.state.pricingBatches), [["id-selected"]]);
  assert.deepEqual(plain(f.state.titleBatches), [["id-selected"]]);
  assert.ok(f.state.cacheDefinitions.every(({ config }) => config.revalidate === 60 && config.tags.includes("catalogue")));
});

test("metadata and page deduplicate within a request while referral prices stay outside the shared slug cache", async () => {
  const f = fixture([row("one"), row("two")]);
  f.state.margin = 7;
  const metadata = f.fetchErpProductBySlug("one");
  const detail = f.fetchErpProductBySlug("one");
  assert.equal(metadata, detail);
  assert.equal((await detail).price, 87);
  assert.deepEqual(f.state.resellerProducts, ["one"]);
  f.nextRequest();
  f.state.margin = 20;
  assert.equal((await f.fetchErpProductBySlug("one")).price, 100);
  assert.equal(f.state.requests.length, 1, "The base product persists across requests");
  assert.equal((await f.fetchErpProductBySlug("two")).slug, "two");
  assert.equal(f.state.requests.length, 2, "Each slug has its own cache entry");
  assert.deepEqual(f.state.resellerProducts, ["one", "one", "two"]);
});

test("missing or unpublished products return null, while database and enrichment failures propagate", async () => {
  const f = fixture([row("hidden")]);
  assert.equal(await f.fetchErpProductBySlug("missing"), null);
  assert.equal(f.state.pricingBatches.length, 0);
  f.state.hiddenIds.add("id-hidden");
  assert.equal(await f.fetchErpProductBySlug("hidden"), null);

  for (const [field, message] of [["publicError", "public view offline"], ["priceError", "Selling prices offline"], ["titleError", "Web Titles offline"]]) {
    const broken = fixture([row("card")]);
    broken.state[field] = message;
    await assert.rejects(() => broken.fetchErpProductBySlug("card"), new RegExp(message));
  }
});

test("related wedding products retain filtering and ranking, exclude self, and only reprice the displayed four", async () => {
  const f = fixture([
    row("self"), row("box", { subject: "Wedding Box" }), row("envelope", { subject: "Shagun Envelopes" }),
    row("rakhi", { subject: "Rakhi" }), row("no-photo", { images: [] }),
    row("unpriced", { updated_at: "2026-10-09T12:00:00Z" }),
    row("older", { updated_at: "2026-09-01T12:00:00Z" }),
    row("newest", { updated_at: "2026-10-08T12:00:00Z" }),
    row("second", { updated_at: "2026-10-07T12:00:00Z" }),
    row("third", { updated_at: "2026-10-06T12:00:00Z" }),
    row("fourth", { updated_at: "2026-10-05T12:00:00Z" }),
  ], { prices: { "id-unpriced": 0 } });
  f.state.margin = 12;
  const products = await f.fetchRelatedErpProducts({ slug: "self", category: "wedding" });
  assert.deepEqual(plain(products.map(({ slug }) => slug)), ["newest", "second", "third", "fourth"]);
  assert.deepEqual(plain(f.state.resellerBatches), [["newest", "second", "third", "fourth"]]);
  assert.ok(products.every(({ price }) => price === 92));
  assert.ok((await f.buildErpProductList()).filter(({ hasPrice }) => hasPrice).every(({ price }) => price === 80));
});

test("related non-wedding products keep their catalogue category and order with a custom limit", async () => {
  const f = fixture([
    row("wedding"), row("self", { subject: "Luxury" }), row("first", { subject: "Luxe Cards" }),
    row("house", { subject: "Housewarming" }), row("second", { subject: "Luxury Invitation" }),
    row("third", { subject: "Luxe Cards" }),
  ]);
  const products = await f.fetchRelatedErpProducts({ slug: "self", category: "luxe" }, 2);
  assert.deepEqual(plain(products.map(({ slug }) => slug)), ["first", "second"]);
  assert.deepEqual(plain(f.state.resellerBatches), [["first", "second"]]);
});
