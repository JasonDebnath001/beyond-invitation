const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(file, imports, globals = {}) {
  const compiled = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    process: { env: {} },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
    ...globals,
  });
  return exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const image = (name) =>
  `https://ldjcivtrbmxmkemjqqdi.supabase.co/storage/v1/object/public/item_images/${name}.jpg`;
const row = (changes = {}) => ({
  id: "item-id",
  item_code: "IT0419",
  design_no: "535093",
  slug: "535093",
  name: "Invitation",
  description: "A wedding invitation",
  price: 90,
  mrp: 100,
  gst_pct: 18,
  image_url: image("primary"),
  thumb_url: image("thumb"),
  images: [image("primary"), image("second")],
  videos: [],
  subject: "Wedding Card",
  tags: ["New"],
  badge: null,
  stock_status: "Available",
  min_order_qty: 50,
  order_multiple: 25,
  group_name: "Supplier / Year",
  width_mm: 125,
  length_mm: 200,
  height_mm: 3,
  weight_g: 40,
  updated_at: "2026-09-14T00:00:00Z",
  ...changes,
});

function loadCatalog(rows = [row()]) {
  const state = { requests: [], margin: 0, cacheKeys: [] };
  const applyPrice = (product) =>
    product && { ...product, price: product.price * (1 + state.margin / 100) };
  const catalog = loadModule("lib/catalog.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/cache": {
      unstable_cache(fn, keys, options) {
        state.cacheKeys.push(keys);
        assert.equal(options.revalidate, 60);
        let cached;
        return () => (cached ??= fn());
      },
    },
    "isomorphic-dompurify": { sanitize: (html) => html },
    "@/lib/reseller": {
      applyResellerPricingToProducts: async (products) =>
        products.map(applyPrice),
      applyResellerPricingToProduct: async (product) => applyPrice(product),
    },
    "@/lib/supabase/server": {
      getSupabaseServerClient: () => ({
        from(table) {
          assert.equal(table, "v_web_products");
          const request = { orders: [] };
          return {
            select(columns) {
              assert.equal(columns, "*");
              return this;
            },
            order(column, options) {
              request.orders.push([column, options]);
              return this;
            },
            range(from, to) {
              request.range = [from, to];
              return this;
            },
            async returns() {
              state.requests.push(request);
              return {
                data: rows.slice(request.range[0], request.range[1] + 1),
                error: null,
              };
            },
          };
        },
      }),
    },
  });
  return { catalog, state };
}

test("null price maps to zero with hasPrice false and no invented MRP", () => {
  const { catalog } = loadCatalog();
  const product = catalog.mapCatalogRowToProduct(
    row({ price: null, mrp: null }),
  );
  assert.equal(product.price, 0);
  assert.equal(product.mrp, 0);
  assert.equal(product.hasPrice, false);
});

test("images are deduplicated with the primary first, without using the thumbnail as a gallery image", () => {
  const { catalog } = loadCatalog();
  const product = catalog.mapCatalogRowToProduct(
    row({
      images: [image("second"), null, "", image("primary"), image("second")],
    }),
  );
  assert.deepEqual(Array.from(product.images), [
    image("primary"),
    image("second"),
  ]);
  assert.deepEqual(
    Array.from(
      catalog.mapCatalogRowToProduct(row({ image_url: null, images: null }))
        .images,
    ),
    [],
  );
});

test("unknown and absent Subjects fall back to wedding, never the supplier group", () => {
  const { catalog } = loadCatalog();
  for (const subject of [null, "", "Hindi", "Common", "Invitation"]) {
    const product = catalog.mapCatalogRowToProduct(
      row({ subject, group_name: "Luxury supplier" }),
    );
    assert.equal(product.category, "wedding");
    assert.equal(product.subject, subject ?? "");
  }
});

test("category keyword mapping uses Subject", () => {
  const { catalog } = loadCatalog();
  for (const [subject, category] of [
    ["Luxury", "luxe"],
    ["Luxe", "luxe"],
    ["House Warming", "housewarming"],
    ["Thread Ceremony", "thread-ceremony"],
    ["Naming", "naming-ceremony"],
    ["Birthday", "birthday"],
    ["Baby Shower", "baby-shower"],
  ])
    assert.equal(
      catalog.mapCatalogRowToProduct(row({ subject })).category,
      category,
    );
});

test("slug passes through unchanged; item identities use the design number", () => {
  const { catalog } = loadCatalog();
  const product = catalog.mapCatalogRowToProduct(
    row({ slug: "existing-535093" }),
  );
  assert.equal(product.slug, "existing-535093");
  assert.equal(product.itemCode, "535093");
  assert.equal(product.erpName, "535093");
  assert.equal(product.emoji, "");
  assert.equal("brand_name" in product, false);
});

test("numeric prices, millimetres, grams, tags and order metadata are preserved", () => {
  const { catalog } = loadCatalog();
  const product = catalog.mapCatalogRowToProduct(
    row({ price: "90.50", gst_pct: "18" }),
  );
  assert.equal(product.price, 90.5);
  assert.equal(product.hasPrice, true);
  assert.equal(product.badge, "New");
  assert.equal(
    catalog.mapCatalogRowToProduct(row({ badge: "Offer" })).badge,
    "Offer",
  );
  assert.deepEqual(plain(product.dimensions), {
    height: 3,
    width: 125,
    depth: 200,
    weight: 40,
  });
  assert.deepEqual(Array.from(product.tags), ["New"]);
  assert.equal(product.stockStatus, "Available");
  assert.equal(product.minOrderQty, 50);
  assert.equal(product.orderMultiple, 25);
  assert.equal(product.gstPct, 18);
});

test("all list/detail/subject reads share a cached base list without caching reseller margins", async () => {
  const { catalog, state } = loadCatalog();
  const [base, list, detail, subjects] = await Promise.all([
    catalog.fetchErpProductsBase(),
    catalog.fetchErpProducts(),
    catalog.fetchErpProductBySlug("535093"),
    catalog.fetchErpProductsBySubject("wedding card"),
  ]);
  assert.equal(state.requests.length, 1);
  assert.equal(base[0].price, 90);
  assert.equal(list[0].price, 90);
  assert.equal(detail.slug, subjects[0].slug);
  state.margin = 20;
  assert.equal((await catalog.fetchErpProducts())[0].price, 108);
  assert.equal((await catalog.fetchErpProductBySlug("535093")).price, 108);
  assert.equal((await catalog.buildErpProductList())[0].price, 90);
  state.margin = 0;
  assert.equal((await catalog.fetchErpProducts())[0].price, 90);
  assert.equal(await catalog.fetchErpProductBySlug("missing"), null);
  assert.equal(state.requests.length, 1);
});

test("subject filters are exact and case-insensitive; language/unassigned subjects stay out of collections", async () => {
  const { catalog } = loadCatalog([
    row({ slug: "hindu", subject: "Hindu Wedding Card" }),
    row({ slug: "shared", subject: "Wedding Card" }),
    row({ slug: "hindi", subject: "Hindi" }),
    row({ slug: "none", subject: null }),
    row({ slug: "partial", subject: "Hindu Wedding Card Extra" }),
  ]);
  const result = await catalog.fetchErpProductsBySubject([
    " hindu wedding CARD ",
    "wedding card",
  ]);
  assert.deepEqual(
    Array.from(result, (p) => p.slug),
    ["hindu", "shared"],
  );
  assert.deepEqual(Array.from(await catalog.fetchErpProductsBySubject([])), []);
  assert.deepEqual(
    Array.from(
      await catalog.fetchErpProductsByCategory("wedding"),
      (p) => p.slug,
    ),
    ["hindi", "hindu", "none", "partial", "shared"],
  );
  assert.equal((await catalog.getCatalogProducts()).length, 5);
});

test("range pagination returns every row with stable updated_at ordering", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) =>
    row({ id: String(i), slug: String(i) }),
  );
  const { catalog, state } = loadCatalog(rows);
  assert.equal((await catalog.buildErpProductList()).length, 1001);
  assert.deepEqual(plain(state.requests.map((request) => request.range)), [
    [0, 999],
    [1000, 1999],
  ]);
  assert.deepEqual(plain(state.requests[0].orders), [
    ["updated_at", { ascending: false }],
    ["id", { ascending: true }],
  ]);
});

function loadCheckout(products) {
  const quantity = loadModule("lib/product-quantity.ts", {});
  const reseller = loadModule("lib/reseller.ts", { "next/headers": {} });
  return loadModule("lib/checkout.ts", {
    "@/lib/catalog": { buildErpProductList: async () => products },
    "@/lib/product-quantity": quantity,
    "@/lib/reseller": reseller,
  });
}

test("checkout rejects an unpriced line even when mixed with a paid item", async () => {
  const { catalog } = loadCatalog();
  const paid = catalog.mapCatalogRowToProduct(row());
  const unpriced = catalog.mapCatalogRowToProduct(
    row({ slug: "unpriced", design_no: "unpriced", price: null }),
  );
  const checkout = loadCheckout([paid, unpriced]);
  await assert.rejects(
    checkout.resolveCartProducts([
      { slug: paid.slug, quantity: 50 },
      { slug: unpriced.slug, quantity: 50 },
    ]),
    /price on request.*contact us/i,
  );
});

test("checkout uses base catalogue prices and the existing reseller margin once", async () => {
  const { catalog } = loadCatalog();
  const product = catalog.mapCatalogRowToProduct(row());
  const checkout = loadCheckout([product]);
  const result = await checkout.resolveCartProducts(
    [{ itemCode: "535093", quantity: 50 }],
    { active: true, marginPercent: 10 },
  );
  assert.equal(result.lines[0].basePrice, 90);
  assert.equal(result.lines[0].price, 99);
  assert.equal(result.amountPaise, 495000);
  assert.equal(result.commission, 450);
});

test("server client initializes lazily and applies the 60-second fetch policy", async () => {
  let created = 0;
  let options;
  let fetchOptions;
  const env = {};
  const server = loadModule(
    "lib/supabase/server.ts",
    {
      "server-only": {},
      "@supabase/supabase-js": {
        createClient(url, key, config) {
          created++;
          assert.equal(url, "https://example.supabase.co");
          assert.equal(key, "test-anon-key");
          options = config;
          return {};
        },
      },
    },
    {
      process: { env },
      fetch: async (_, init) => {
        fetchOptions = init;
      },
    },
  );
  assert.equal(created, 0);
  assert.throws(
    () => server.getSupabaseServerClient(),
    /NEXT_PUBLIC_SUPABASE_URL/,
  );
  env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  const client = server.getSupabaseServerClient();
  assert.equal(server.getSupabaseServerClient(), client);
  assert.equal(created, 1);
  assert.equal(options.auth.persistSession, false);
  await options.global.fetch("https://example.supabase.co", {
    headers: { apikey: "test-anon-key" },
  });
  assert.equal(fetchOptions.next.revalidate, 60);
  assert.equal(fetchOptions.headers.apikey, "test-anon-key");
});
