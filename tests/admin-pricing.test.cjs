const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const ExcelJS = require("exceljs");

function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "..", file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Buffer, URL, File, FormData, console, AbortController, AbortSignal,
      setTimeout, clearTimeout, process: { env: { SUPABASE_SECRET_KEY: "test-only-signing-key" } }, ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === "server-only") return {};
        if (name === "@/lib/supabase/admin") return { getSupabaseAdminClient() { throw new Error("No live database in tests"); } };
        if (name.startsWith("./") || name.startsWith("@/")) {
          const target = name.startsWith("@/") ? path.resolve(__dirname, "..", name.slice(2)) : path.resolve(path.dirname(filename), name);
          return load(`${target}.${fs.existsSync(`${target}.ts`) ? "ts" : "tsx"}`);
        }
        return require(name);
      },
    });
    return exports;
  }
  return load;
}
const plain = value => JSON.parse(JSON.stringify(value));
const companyId = "11111111-1111-4111-a111-111111111111";
const itemId = "22222222-2222-4222-a222-222222222222";
const otherId = "33333333-3333-4333-a333-333333333333";
const stamp = "2026-09-28T00:00:00Z";
const item = { id: itemId, company_id: companyId, name: "DESIGN-1", code: "000123", updated_at: stamp, sale_price: 80, mrp: 120, print_name: "A card" };
const context = () => ({ companyId, sharedCompanyIds: [], lookups: {}, items: [{ ...item }] });
const load = loader();
const { parseItemUpload } = load("lib/admin/item-upload.ts");
const { planPriceImport } = load("lib/admin/price-plan.ts");
const { parseItemEditRequest, planItemEdit } = load("lib/admin/item-edit.ts");
const { commitItemPlan, signPreview, verifyPreview } = load("lib/admin/item-service.ts");
async function plan(csv, ctx = context()) {
  return planPriceImport(await parseItemUpload(Buffer.from(csv), "prices.csv", "prices"), ctx);
}

test("CSV price upload matches exact item codes, preserves leading zeros and only changes prices", async () => {
  const ctx = context();
  ctx.items.push({ ...item, id: otherId, code: "OTHER", name: "OTHER" });
  const result = await plan('\uFEFFItem Code,Showcase Price,Actual Price\r\n 000123 ,150,99.50', ctx);
  assert.deepEqual(plain(result.counts), { create: 0, update: 1, unchanged: 0, invalid: 0 });
  assert.deepEqual(plain(result.rows[0].patch), { mrp: 150, sale_price: 99.5 });
  assert.equal(result.rows[0].id, itemId);
  assert.equal(result.rows[0].expectedUpdatedAt, stamp);
  assert.equal(result.rows[0].designNo, "000123");
});

test("price uploads reject duplicate, unknown and wrong-company identities without creating items", async () => {
  const result = await plan("Item Code,Actual Price\n000123,90\n000123,95\nDESIGN-1,80\nNO-SUCH-CODE,80\n,50");
  assert.equal(result.counts.invalid, 5);
  assert.equal(result.counts.create, 0);
  const wrongCompany = context();
  wrongCompany.items[0].company_id = otherId;
  assert.equal((await plan("Item Code,Actual Price\n000123,90", wrongCompany)).counts.invalid, 1);
  const ambiguous = context();
  ambiguous.items.push({ ...item, id: otherId });
  assert.match((await plan("Item Code,Actual Price\n000123,90", ambiguous)).rows[0].errors.join(), /More than one/);
});

test("price uploads accept storefront design numbers as well as internal item codes", async () => {
  const result = await plan("Item Code,Showcase Price,Actual Price\n design-1 ,150,99.50");
  assert.equal(result.counts.update, 1);
  assert.equal(result.rows[0].id, itemId);
  assert.deepEqual(plain(result.rows[0].matchedItem), { code: "000123", designNo: "DESIGN-1" });
  assert.deepEqual(plain(result.rows[0].patch), { mrp: 150, sale_price: 99.5 });
  for (const heading of ["Design Number", "Design No", "design_no", "Item Name"]) {
    assert.equal((await plan(`${heading},Actual Price\nDESIGN-1,90`)).counts.update, 1, heading);
  }
  // The full item importer still treats Item Name as its own field.
  const regular = await parseItemUpload(Buffer.from("Item Name,Actual Price\nDESIGN-1,90"), "items.csv");
  assert.equal(regular.rows[0].values.name, "DESIGN-1");
  assert.equal(regular.rows[0].values.code, undefined);
});

test("an XLSX numeric design number matches its item without changing the identifier or prices during preview", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["Item Code", "Showcase Price", "Actual Price"]);
  sheet.addRow([535137, 150, 99.5]);
  const ctx = context(); ctx.items[0].name = "535137"; ctx.items[0].code = "IT0463";
  const parsed = await parseItemUpload(Buffer.from(await workbook.xlsx.writeBuffer()), "prices.xlsx", "prices");
  const result = planPriceImport(parsed, ctx);
  assert.equal(result.counts.update, 1);
  assert.equal(result.rows[0].id, itemId);
  assert.deepEqual(plain(result.rows[0].matchedItem), { code: "IT0463", designNo: "535137" });
  assert.equal(ctx.items[0].sale_price, 80);
  assert.equal(ctx.items[0].name, "535137");
});

test("different identifiers for the same product are all rejected as duplicate upload rows", async () => {
  const result = await plan("Item Code,Actual Price\n000123,90\nDESIGN-1,100");
  assert.equal(result.counts.invalid, 2);
  assert.equal(result.counts.update, 0);
  for (const row of result.rows) assert.match(row.errors.join(), /one row per product/);
});

test("code/design collisions never select one product arbitrarily and matching remains company-scoped", async () => {
  const ctx = context();
  ctx.items.push({ ...item, id: otherId, name: "000123", code: "IT9999" });
  assert.equal((await plan("Item Code,Actual Price\n000123,90", ctx)).counts.invalid, 1);
  ctx.items[1].company_id = otherId;
  assert.equal((await plan("Item Code,Actual Price\n000123,90", ctx)).rows[0].id, itemId);
  assert.equal((await plan("Item Code,Actual Price\nIT9999,90", ctx)).counts.invalid, 1);
  ctx.items[0].code = ctx.items[0].name;
  assert.equal((await plan("Item Code,Actual Price\nDESIGN-1,90", ctx)).counts.update, 1);
});

test("price matching ignores case and surrounding spaces, while preserving other product details", async () => {
  const ctx = context(); ctx.items[0].code = "IT0123";
  const result = await plan("Item Code,Actual Price\n it0123 ,90", ctx);
  assert.equal(result.counts.update, 1);
  assert.deepEqual(plain(result.rows[0].patch), { sale_price: 90 });
  assert.equal(ctx.items[0].print_name, "A card");
});

test("blank cells preserve prices, explicit clearing removes the showcase or restores both price-list values", async () => {
  assert.equal((await plan("Item Code,Showcase Price,Actual Price\n000123,,")).counts.unchanged, 1);
  assert.deepEqual(plain((await plan("Item Code,Showcase Price,Actual Price\n000123,[clear],")).rows[0].patch), { mrp: null });
  const cleared = await plan("Item Code,Showcase Price,Actual Price\n000123,[clear],[clear]");
  assert.deepEqual(plain(cleared.rows[0].patch), { mrp: null, sale_price: null });
  assert.equal(cleared.counts.update, 1);
  assert.equal((await plan("Item Code,Actual Price\n000123,[clear]")).counts.invalid, 1);
});

test("prices validate precision, positivity, range and showcase/actual relationship", async () => {
  for (const value of ["0", "-1", "NaN", "Infinity", "1e2", "0x10", "3.141", "100000000", "₹80", "=1+2"]) {
    assert.equal((await plan(`Item Code,Actual Price\n000123,${value}`)).counts.invalid, 1, value);
  }
  assert.equal((await plan("Item Code,Showcase Price,Actual Price\n000123,70,80")).counts.invalid, 1);
  assert.equal((await plan("Item Code,Showcase Price,Actual Price\n000123,80,80")).counts.update, 1);
  assert.equal((await plan('Item Code,Showcase Price,Actual Price\n000123,"1,500.00","1,000.50"')).counts.update, 1);
  const ctx = context(); ctx.items[0].sale_price = null; ctx.items[0].mrp = null;
  assert.equal((await plan("Item Code,Showcase Price,Actual Price\n000123,100,", ctx)).counts.invalid, 1);
});

test("manual editor uses the same price validation and optimistic item version", () => {
  const input = parseItemEditRequest({ companyId, id: itemId, expectedUpdatedAt: stamp, values: { mrp: "150", sale_price: "90.25" } });
  assert.deepEqual(plain(planItemEdit(input, context()).rows[0].patch), { mrp: 150, sale_price: 90.25 });
  assert.throws(() => planItemEdit({ ...input, values: { mrp: "50" } }, context()), /Check the item/);
  assert.throws(() => planItemEdit({ ...input, expectedUpdatedAt: "2026-09-27T00:00:00Z" }, context()), /changed since/);
  const clear = parseItemEditRequest({ companyId, id: itemId, expectedUpdatedAt: stamp, values: { mrp: "", sale_price: "" } });
  assert.deepEqual(plain(planItemEdit(clear, context()).rows[0].patch), { mrp: null, sale_price: null });
});

test("XLSX imports read numeric prices and text/zero-padded codes, and flag formulas and cell errors", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(["Item Code", "Showcase Price", "Actual Price"]);
  sheet.addRow([123, 150, 99.5]); sheet.getCell("A2").numFmt = "000000";
  sheet.addRow(["000124", 150, { formula: "100-1", result: 99 }]);
  sheet.addRow(["000125", 150, { error: "#VALUE!" }]);
  const parsed = await parseItemUpload(Buffer.from(await workbook.xlsx.writeBuffer()), "prices.xlsx", "prices");
  assert.equal(parsed.rows[0].values.code, "000123");
  assert.equal(parsed.rows[0].values.sale_price, "99.5");
  assert.equal(parsed.rows[0].errors.length, 0);
  assert.match(parsed.rows[1].errors[0], /replace formulas/);
  assert.match(parsed.rows[2].errors[0], /spreadsheet errors/);
  assert.equal(planPriceImport(parsed, context()).counts.update, 1);
});

test("uploads enforce schema and limits, and reject attempts to change unrelated fields", async () => {
  for (const csv of ["Item Code,MRP\n000123,100", "Actual Price\n80", "Item Code,Actual Price,Sale Price\n000123,80,90", "Item Code,Actual Price,Print Name\n000123,80,Changed"]) {
    await assert.rejects(() => parseItemUpload(Buffer.from(csv), "prices.csv", "prices"));
  }
  await assert.rejects(() => parseItemUpload(Buffer.alloc(4 * 1024 * 1024 + 1), "prices.csv", "prices"), /4 MB/);
  await assert.rejects(() => parseItemUpload(Buffer.from("Item Code,Actual Price\n" + "000123,80\n".repeat(1001)), "prices.csv", "prices"), /1,000/);
  await assert.rejects(() => parseItemUpload(Buffer.from("data"), "prices.xls", "prices"), /CSV or XLSX/);
});

test("signed previews reject changed files, changed prices, changed companies and expired tokens", async () => {
  const preview = await plan("Item Code,Actual Price\n000123,90");
  const token = signPreview(preview, "prices-file-hash", 1000);
  assert.doesNotThrow(() => verifyPreview(token, preview, "prices-file-hash", 2000));
  assert.throws(() => verifyPreview(token, preview, "other-file-hash", 2000), /changed/);
  assert.throws(() => verifyPreview(token, { ...preview, companyId: otherId }, "prices-file-hash", 2000), /changed/);
  const changed = plain(preview); changed.rows[0].patch.sale_price = 1;
  assert.throws(() => verifyPreview(token, changed, "prices-file-hash", 2000), /changed/);
  assert.throws(() => verifyPreview(token, preview, "prices-file-hash", 2000000), /expired/);
});

test("commits save both prices together, scope company and item, and reject stale rows", async () => {
  const preview = await plan("Item Code,Showcase Price,Actual Price\n000123,150,90\nUNKNOWN,200,100");
  let record = { ...item };
  const db = { from(table) {
    assert.equal(table, "items");
    const filters = []; let patch;
    const query = {
      update(value) { patch = plain(value); return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      async select() {
        assert.deepEqual(filters, [["id", itemId], ["company_id", companyId], ["updated_at", stamp]]);
        if (!filters.every(([key, value]) => record[key] === value)) return { data: [], error: null };
        Object.assign(record, patch); return { data: [{ id: record.id }], error: null };
      },
    }; return query;
  } };
  const result = await commitItemPlan(preview, db);
  assert.equal(result.updated, 1); assert.equal(result.skipped, 1);
  assert.equal(record.sale_price, 90); assert.equal(record.mrp, 150);
  assert.equal(record.print_name, "A card");
  const retry = await commitItemPlan(preview, db);
  assert.equal(retry.updated, 0); assert.equal(retry.failed, 1);
  assert.match(retry.rows[0].message, /changed after preview/);
});

test("catalogue applies saved prices only to public active items and preserves price-list fallback", async () => {
  const { applyItemPrices } = load("lib/catalog-pricing.ts");
  const calls = [];
  const db = { from(table) {
    assert.equal(table, "items");
    const query = {
      select(columns) { assert.equal(columns, "id,sale_price,mrp"); return query; },
      in(column, ids) { assert.equal(column, "id"); calls.push(ids); return query; },
      eq(key, value) { assert.ok(["show_on_website", "is_active"].includes(key)); assert.equal(value, true); return query; },
      then(resolve) { resolve({ data: [{ id: "override", sale_price: 80, mrp: 120 }, { id: "fallback", sale_price: null, mrp: null }, { id: "no-showcase", sale_price: 60, mrp: null }], error: null }); },
    }; return query;
  } };
  const result = await applyItemPrices([
    { id: "override", price: 500, mrp: 600 }, { id: "fallback", price: 75, mrp: 100 },
    { id: "no-showcase", price: 50, mrp: 500 }, { id: "now-hidden", price: 50, mrp: 100 },
  ], db);
  assert.deepEqual(plain(result), [{ id: "override", price: 80, mrp: 120 }, { id: "fallback", price: 75, mrp: 100 }, { id: "no-showcase", price: 60, mrp: null }]);
  assert.deepEqual(plain(calls), [["override", "fallback", "no-showcase", "now-hidden"]]);
  db.from = () => ({ select() { return this; }, in() { return this; }, eq() { return this; }, then(resolve) { resolve({ data: null, error: { message: "offline" } }); } });
  await assert.rejects(() => applyItemPrices([{ id: "override", price: 500, mrp: 600 }], db), /prices unavailable/);
});

test("storefront crosses out only showcase prices above actual; checkout charges actual regardless of supplied prices", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const Price = load("components/ProductPrice.tsx").default;
  const markup = renderToStaticMarkup(React.createElement(Price, { price: 80, mrp: 120 }));
  assert.match(markup, /₹80/); assert.match(markup, /<del[^>]*>.*₹120<\/del>/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Price, { price: 80, mrp: 80 })), /<del/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Price, { price: 80, mrp: 0 })), /<del/);
  const checkout = loader({
    "@/lib/catalog": { buildErpProductList: async () => [{ itemCode: "DESIGN-1", slug: "design-1", name: "Card", price: 80, mrp: 120, hasPrice: true }] },
    "@/lib/reseller": { applyMarginToPrice: (price, margin) => Math.round(price * (1 + margin / 100)) },
  })("lib/checkout.ts");
  const cart = await checkout.resolveCartProducts([{ itemCode: "DESIGN-1", quantity: 50, price: 1, mrp: 2 }]);
  assert.equal(cart.amountPaise, 400000); assert.equal(cart.lines[0].price, 80);
});

test("price import endpoint previews before writing, verifies tokens and invalidates storefront cache after saving", async () => {
  const ctx = context(); const writes = []; const invalidations = [];
  const route = loader({
    "next/cache": { revalidateTag: tag => invalidations.push(tag), revalidatePath: route => invalidations.push(route) },
    "@/lib/admin/item-service": {
      loadPriceContext: async id => { assert.equal(id, companyId); return ctx; },
      loadItemContext: () => { throw new Error("Price uploads should not load unrelated references"); },
      signPreview, verifyPreview,
      commitItemPlan: async value => { writes.push(plain(value)); return { updated: 1, created: 0 }; },
    },
  })("app/api/admin/items/import/route.ts");
  const { NextRequest } = require("next/server");
  const request = (action = "preview", token, origin = "http://localhost", csv = "Item Code,Actual Price\n000123,90") => {
    const form = new FormData(); form.set("companyId", companyId); form.set("mode", "prices"); form.set("action", action);
    form.set("file", new File([csv], "prices.csv")); if (token) form.set("token", token);
    return new NextRequest("http://localhost/api/admin/items/import", { method: "POST", headers: { origin }, body: form });
  };
  assert.equal((await route.POST(request("preview", null, "https://other.test"))).status, 403);
  const previewResponse = await route.POST(request());
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json();
  assert.equal(preview.plan.counts.update, 1); assert.equal(writes.length, 0);
  assert.equal((await route.POST(request("commit"))).status, 409);
  assert.equal((await route.POST(request("commit", preview.token, "http://localhost", "Item Code,Actual Price\n000123,95"))).status, 409);
  assert.equal((await route.POST(request("commit", preview.token))).status, 200);
  assert.equal(writes.length, 1); assert.deepEqual(invalidations, ["catalogue", "/"]);
});

test("main catalogue, category collections and checkout all resolve the same saved actual and showcase prices", async () => {
  const publicRow = { id: itemId, item_code: "000123", design_no: "DESIGN-1", slug: "design-1", name: "Card", price: 500, mrp: 600, updated_at: stamp };
  const publicDb = { from(table) {
    assert.equal(table, "v_web_products");
    return { select() { return this; }, order() { return this; }, range() { return this; }, in() { return this; }, returns: async () => ({ data: [publicRow], error: null }) };
  } };
  const adminDb = { from(table) {
    assert.equal(table, "items");
    return {
      select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, range() { return this; },
      returns: async () => ({ data: [{ id: itemId, item_categories: { name: "Wedding Card" } }], error: null }),
      then(resolve) { resolve({ data: [{ id: itemId, sale_price: 99.5, mrp: 150 }], error: null }); },
    };
  } };
  const integrated = loader({
    react: { cache: fn => fn },
    "next/cache": { unstable_cache: fn => fn },
    "isomorphic-dompurify": { sanitize: value => value },
    "@/lib/supabase/server": { getSupabaseServerClient: () => publicDb },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => adminDb },
    "@/lib/reseller": { applyResellerPricingToProducts: async products => products, applyResellerPricingToProduct: async product => product },
  });
  const catalogue = await integrated("lib/catalog.ts").buildErpProductList();
  const category = integrated("lib/catalog-item-category.ts");
  const collection = await category.fetchProductsByItemCategory("Wedding Card");
  const wedding = await category.fetchWeddingCardsWithCategories();
  for (const products of [catalogue, collection, wedding]) {
    assert.equal(products.length, 1); assert.equal(products[0].price, 99.5); assert.equal(products[0].mrp, 150);
  }
  const cart = await integrated("lib/checkout.ts").resolveCartProducts([{ slug: "design-1", quantity: 50 }]);
  assert.equal(cart.amountPaise, 497500);
});
