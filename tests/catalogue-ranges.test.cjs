const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Load the real TypeScript modules with explicit boundary doubles. Unexpected
// imports fail immediately, so these tests cannot reach a database or network.
function loadTypeScript(file, imports = {}, logger = console) {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const module = { exports: {} };
  const requireStub = (name) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
    return imports[name];
  };
  new Function("require", "module", "exports", "console", outputText)(
    requireStub, module, module.exports, logger,
  );
  return module.exports;
}

const ranges = loadTypeScript("lib/catalogue-ranges.ts");
const browseOptions = loadTypeScript("lib/catalog-browse-options.ts");
const { repriceProduct } = loadTypeScript("lib/reseller.ts", {
  "next/headers": { cookies: async () => ({ get: () => undefined }) },
});
const pageSize = browseOptions.COLLECTION_PAGE_SIZE;
const maximumOffset = 2147483647 - pageSize;

function product(slug, mrp, price = mrp) {
  return {
    slug, name: `Design ${slug}`, price, mrp,
    images: [`/${slug}-1.jpg`, `/${slug}-2.jpg`, `/${slug}-3.jpg`],
    videos: [`/${slug}.mp4`], description: "Original product description",
    dimensions: { width: 12, height: 18 }, category: "wedding", emoji: "",
    minOrderQty: 100, orderMultiple: 50,
  };
}

function createReader(source, priceProducts = async (products) => products) {
  const calls = { source: 0, pricing: 0 };
  const { fetchCatalogueRangePage } = loadTypeScript("lib/catalogue-range-products.ts", {
    "server-only": {},
    "@/lib/catalog": {
      fetchWeddingCardProductsBase: async () => {
        calls.source++;
        return typeof source === "function" ? source() : source;
      },
    },
    "@/lib/catalog-browse-options": browseOptions,
    "@/lib/catalogue-ranges": ranges,
    "@/lib/reseller": {
      applyResellerPricingToProducts: async (products) => {
        calls.pricing++;
        return priceProducts(products);
      },
    },
  });
  return { read: fetchCatalogueRangePage, calls };
}

function createRoute(read) {
  const calls = [];
  const errors = [];
  const { GET } = loadTypeScript("app/api/catalog/ranges/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/catalog-browse-options": browseOptions,
    "@/lib/catalogue-ranges": ranges,
    "@/lib/catalogue-range-products": {
      fetchCatalogueRangePage: async (...args) => {
        calls.push(args);
        return read(...args);
      },
    },
  }, { error: (...args) => errors.push(args) });
  return {
    get: (query) => GET(new Request(`http://localhost/api/catalog/ranges${query}`)),
    calls,
    errors,
  };
}

test("MRP bands cover their exact boundaries without overlap", () => {
  assert.deepEqual(ranges.CATALOGUE_RANGES.map(({ id }) => id), ["affordable", "mid-range", "premium"]);
  const cases = [
    [0.01, "affordable"], [49.99, "affordable"], [50, "mid-range"],
    [149.99, "mid-range"], [150, "premium"], [300, "premium"], [300.01, null],
    [0, null], [-1, null], [NaN, null], [Infinity, null], [-Infinity, null],
    [undefined, null], [null, null], ["50", null],
  ];
  for (const [mrp, expected] of cases) {
    const matches = ranges.CATALOGUE_RANGES.filter((range) => ranges.isInCatalogueRange(mrp, range));
    assert.deepEqual(matches.map(({ id }) => id), expected ? [expected] : [], `MRP ${String(mrp)}`);
  }
  for (const invalid of [null, "", "stock-clearance", "fast-selling-cards", "Affordable", "toString"]) {
    assert.equal(ranges.getCatalogueRange(invalid), undefined);
  }
});

test("range membership uses MRP rather than the discounted selling price", async () => {
  const reader = createReader([
    product("affordable", 40, 20), product("mid", 100, 30), product("premium", 200, 40),
  ]);
  for (const [range, slug] of [["affordable", "affordable"], ["mid-range", "mid"], ["premium", "premium"]]) {
    const page = await reader.read(range);
    assert.deepEqual(page.products.map((item) => item.slug), [slug]);
    assert.equal(page.total, 1);
  }
});

test("visitor pricing is applied once before filtering and preserves base products", async () => {
  const source = [product("moves-to-mid", 49, 20), product("moves-to-premium", 149, 50), product("moves-out", 280, 100)];
  const original = structuredClone(source);
  const reader = createReader(source, async (products) => products.map((item) => repriceProduct(item, { marginPercent: 10 })));
  const affordable = await reader.read("affordable");
  const mid = await reader.read("mid-range");
  const premium = await reader.read("premium");
  assert.equal(affordable.total, 0);
  assert.deepEqual(mid.products.map(({ slug, price, mrp }) => ({ slug, price, mrp })), [
    { slug: "moves-to-mid", price: 22, mrp: 54 },
  ]);
  assert.deepEqual(premium.products.map(({ slug, price, mrp }) => ({ slug, price, mrp })), [
    { slug: "moves-to-premium", price: 55, mrp: 164 },
  ]);
  assert.deepEqual(reader.calls, { source: 3, pricing: 3 });
  assert.deepEqual(source, original);
});

test("filtering precedes pagination, with stable totals and no gaps or duplicates", async () => {
  const matching = Array.from({ length: pageSize + 5 }, (_, index) => product(`match-${index}`, 100));
  const source = matching.flatMap((item, index) => [product(`outside-${index}`, 400), item]);
  const { read } = createReader(source);
  const first = await read("mid-range");
  const last = await read("mid-range", first.nextOffset);
  const empty = await read("mid-range", pageSize * 2);
  assert.equal(first.products.length, pageSize);
  assert.equal(first.nextOffset, pageSize);
  assert.equal(last.products.length, 5);
  assert.equal(last.nextOffset, null);
  assert.deepEqual([...first.products, ...last.products].map(({ slug }) => slug), matching.map(({ slug }) => slug));
  assert.deepEqual(empty.products, []);
  assert.equal(empty.nextOffset, null);
  for (const page of [first, last, empty]) assert.equal(page.total, matching.length);
});

test("page summaries preserve galleries and order constraints without mutating cached data", async () => {
  const sourceProduct = product("gallery", 30);
  const original = structuredClone(sourceProduct);
  Object.freeze(sourceProduct.images);
  Object.freeze(sourceProduct.videos);
  Object.freeze(sourceProduct.dimensions);
  Object.freeze(sourceProduct);
  const { read } = createReader(Object.freeze([sourceProduct]));
  const { products: [summary] } = await read("affordable");
  assert.equal(summary.imageCount, 3);
  assert.deepEqual(summary.images, ["/gallery-1.jpg"]);
  assert.notEqual(summary.images, sourceProduct.images);
  assert.deepEqual(summary.videos, []);
  assert.equal(summary.description, "");
  assert.equal(summary.dimensions, undefined);
  assert.equal(summary.minOrderQty, 100);
  assert.equal(summary.orderMultiple, 50);
  assert.deepEqual(sourceProduct, original);
});

test("reader rejects invalid ranges and offsets before reading or pricing products", async () => {
  const reader = createReader([]);
  await assert.rejects(reader.read("unknown"), /valid catalogue range and offset/);
  for (const offset of [-1, 0.5, NaN, Infinity, maximumOffset + 1, Number.MAX_SAFE_INTEGER, "0", null]) {
    await assert.rejects(reader.read("affordable", offset), /valid catalogue range and offset/);
  }
  assert.deepEqual(reader.calls, { source: 0, pricing: 0 });
  assert.deepEqual(await reader.read("affordable", maximumOffset), { products: [], total: 0, nextOffset: null });
});

test("reader propagates source failures instead of reporting an empty range", async () => {
  const failure = new Error("Catalogue unavailable");
  const reader = createReader(() => { throw failure; });
  await assert.rejects(reader.read("premium"), (error) => error === failure);
  assert.deepEqual(reader.calls, { source: 1, pricing: 0 });
});

test("route serves each known range, defaults offset to zero, and keeps responses private", async () => {
  const page = { products: [], nextOffset: null, total: 0 };
  const route = createRoute(async () => page);
  for (const range of ["affordable", "mid-range", "premium"]) {
    const response = await route.get(`?range=${range}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), page);
  }
  await route.get(`?range=mid-range&offset=${pageSize}`);
  await route.get(`?range=premium&offset=${maximumOffset}`);
  assert.deepEqual(route.calls, [
    ["affordable", 0], ["mid-range", 0], ["premium", 0],
    ["mid-range", pageSize], ["premium", maximumOffset],
  ]);
});

test("route rejects malformed filters before invoking the catalogue reader", async () => {
  const route = createRoute(() => { throw new Error("Must not read for invalid input"); });
  const queries = ["", "?range=unknown", "?range=stock-clearance", "?range=Affordable"];
  for (const offset of ["", "-1", "1.5", "1e3", " 1", "Infinity", "NaN", "0x10", String(maximumOffset + 1), "9007199254740992"]) {
    queries.push(`?range=affordable&offset=${encodeURIComponent(offset)}`);
  }
  for (const query of queries) {
    const response = await route.get(query);
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match((await response.json()).error, /valid catalogue range and offset/);
  }
  assert.deepEqual(route.calls, []);
  assert.deepEqual(route.errors, []);
});

test("route returns a private 503 without exposing upstream error details", async () => {
  const route = createRoute(() => { throw new Error("Private database diagnostic"); });
  const response = await route.get("?range=premium");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: "Unable to load wedding cards. Please try again." });
  assert.equal(route.errors.length, 1);
});
