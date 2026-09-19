const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}
const category = "Hindu Wedding Card";
function fixture(items, options = {}) {
  const state = { membershipReads: 0, publicReads: 0, margin: 0 };
  const publicRows = items.filter(item => item.public !== false && item.active !== false && item.visible !== false);
  const mapProduct = row => ({ catalogId: row.id, slug: row.slug || row.id, subject: row.subject || "", price: 100, images: [], hasPrice: true, updatedAt: row.updatedAt || "2026-09-19" });
  const module = load("lib/catalog-item-category.ts", {
    "server-only": {},
    "next/cache": { unstable_cache(fn, keys, config) {
      assert.equal(config.revalidate, 60);
      assert.ok(config.tags.includes("catalogue"));
      const cache = new Map();
      return name => { if (!cache.has(name)) cache.set(name, fn(name)); return cache.get(name); };
    } },
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => ({ from(table) {
      assert.equal(table, "items");
      const filters = {};
      return {
        select(fields) { assert.equal(fields, "id,item_categories!inner(name)"); return this; },
        eq(field, value) { filters[field] = value; return this; },
        order(field) { assert.equal(field, "id"); return this; },
        range(from, to) { this.from = from; this.to = to; return this; },
        async returns() {
          const { from, to } = this;
          state.membershipReads++;
          assert.equal(filters.show_on_website, true);
          assert.equal(filters.is_active, true);
          return { data: items.filter(item => (filters["item_categories.name"] ? item.category === filters["item_categories.name"] : !!item.category) && item.active !== false && item.visible !== false).slice(from, to + 1).map(item => ({ id: item.id, item_categories: { name: item.category } })), error: options.membershipError ? { message: "unavailable" } : null };
        },
      };
    } }) },
    "@/lib/supabase/server": { getSupabaseServerClient: () => ({ from(table) {
      assert.equal(table, "v_web_products"); let ids;
      return {
        select(fields) { assert.equal(fields, "*"); return this; },
        in(field, values) { assert.equal(field, "id"); assert.ok(values.length <= 100); ids = values; return this; },
        async returns() { state.publicReads++; return { data: publicRows.filter(item => ids.includes(item.id)), error: options.publicError ? { message: "unavailable" } : null }; },
      };
    } }) },
    "@/lib/catalog": {
      mapCatalogRowToProduct: mapProduct,
      buildErpProductList: async () => publicRows.map(mapProduct),
      isWeddingCardProduct: product => product.subject !== "Rakhi",
      compareWeddingCardProducts: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug),
    },
    "@/lib/reseller": { applyResellerPricingToProducts: async products => products.map(product => ({ ...product, price: product.price * (1 + state.margin / 100) })) },
  });
  return { ...module, state };
}

test("Hindu collection uses exact Item Category independently of Subject and requires publication", async () => {
  const { fetchProductsByItemCategory } = fixture([
    { id: "category-match", category, subject: null, purchase_cost: 999 },
    { id: "different-subject", category, subject: "Common" },
    { id: "subject-only", category: "Wedding Card", subject: category },
    { id: "generic", category: "Wedding Card", subject: "Wedding Card" },
    { id: "similar", category: "Hindu Wedding Cards", subject: category },
    { id: "missing", category: null, subject: category },
    { id: "hidden", category, visible: false },
    { id: "disabled", category, active: false },
    { id: "excluded-by-view", category, public: false },
  ]);
  const result = await fetchProductsByItemCategory(category);
  assert.deepEqual(Array.from(result, product => product.slug), ["category-match", "different-subject"]);
  assert.ok(result.every(product => !("purchase_cost" in product)));
});
test("category lookup pages beyond 1,000 rows and applies visitor prices outside the shared cache", async () => {
  const api = fixture(Array.from({ length: 1005 }, (_, i) => ({ id: `design-${i}`, category })));
  assert.equal((await api.fetchProductsByItemCategory(category)).length, 1005);
  assert.equal(api.state.membershipReads, 2); assert.equal(api.state.publicReads, 11);
  api.state.margin = 20;
  assert.equal((await api.fetchProductsByItemCategory(category))[0].price, 120);
  assert.equal(api.state.membershipReads, 2); assert.equal(api.state.publicReads, 11);
  assert.equal((await api.fetchProductsByItemCategory("Wedding Card")).length, 0);
});
test("empty categories make no reads, missing assignments return empty, and lookup failures stay errors", async () => {
  const api = fixture([]);
  assert.equal((await api.fetchProductsByItemCategory(" ")).length, 0);
  assert.equal(api.state.membershipReads, 0);
  assert.equal((await api.fetchProductsByItemCategory(category)).length, 0);
  assert.equal(api.state.publicReads, 0);
  await assert.rejects(fixture([], { membershipError: true }).fetchProductsByItemCategory(category), /Item category unavailable/);
  await assert.rejects(fixture([{ id: "one", category }], { publicError: true }).fetchProductsByItemCategory(category), /Product catalogue unavailable/);
});
test("Hindu page requests only its Item Category and preserves the collection error state", async () => {
  const calls = [];
  let fail = false;
  const Shell = () => null;
  const page = load("app/collections/wedding-card-hindu/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "@/lib/catalog-item-category": { fetchProductsByItemCategory: async name => { calls.push(name); if (fail) throw new Error("Unavailable"); return [{ slug: "only-hindu" }]; } },
    "@/components/wedding-cards/WeddingCardsCollection": { default: Shell },
  });
  const result = await page.default();
  assert.deepEqual(calls, [category]);
  assert.equal(result.props.products[0].slug, "only-hindu");
  assert.equal(result.props.collectionType, "hindu");
  fail = true;
  const unavailable = await page.default();
  assert.equal(unavailable.props.products.length, 0);
  assert.ok(unavailable.props.errorMessage);
});

test("main wedding catalogue joins categories by item ID, preserves All, and applies uncached visitor prices", async () => {
  const api = fixture([
    { id: "hindu", slug: "different-design-no", category, subject: "Rakhi" },
    { id: "generic", category: "Wedding Card" },
    { id: "unassigned", category: null },
    { id: "rakhi", category: "Rakhi", subject: "Rakhi" },
    { id: "private", category, public: false },
    { id: "hidden", category, visible: false },
  ]);
  const products = await api.fetchWeddingCardsWithCategories();
  assert.deepEqual(Array.from(products, p => [p.slug, p.itemCategory]), [["different-design-no", category], ["generic", "Wedding Card"], ["unassigned", ""]]);
  api.state.margin = 20;
  assert.equal((await api.fetchWeddingCardsWithCategories())[0].price, 120);
  assert.equal(api.state.membershipReads, 1);
});
