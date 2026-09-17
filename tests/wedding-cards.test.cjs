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
  vm.runInNewContext(source, { exports, URLSearchParams, URL, console, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  }, ...globals });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const helpers = load("lib/wedding-cards.ts");
const image = "https://ldjcivtrbmxmkemjqqdi.supabase.co/storage/v1/object/public/item_images/card.jpg";
const product = { slug: "111015", designNo: "111015", name: "111015", price: 25, mrp: 25, image, imageCount: 2, subject: "Hindi", itemGroup: "Aman 2026", hasPrice: true, minOrderQty: 50, updatedAt: "2026-09-17T00:00:00Z" };

function loadCatalog(rows) {
  const state = { margin: 0, reads: 0, priced: 0 };
  const catalog = load("lib/catalog.ts", {
    "server-only": {}, react: { cache: fn => fn },
    "next/cache": { unstable_cache: fn => { let cached; return () => cached ??= fn(); } },
    "isomorphic-dompurify": { sanitize: value => value },
    "@/lib/supabase/server": { getSupabaseServerClient: () => ({ from() { return this; }, select() { return this; }, order() { return this; }, range() { return this; }, returns: async () => { state.reads++; return { data: rows, error: null }; } }) },
    "@/lib/reseller": {
      applyResellerPricingToProducts: async products => { state.priced++; return products.map(product => ({ ...product, price: product.price * (1 + state.margin / 100) })); },
      applyResellerPricingToProduct: async product => product,
    },
  });
  return { catalog, state };
}

test("wedding catalogue excludes three subjects, ranks photos then prices then newest, and applies uncached reseller pricing", async () => {
  const rows = [
    { slug: "common", subject: "Common", image_url: image, price: 20, updated_at: "2026-09-16" },
    { slug: "hindi", subject: "Hindi", image_url: image, price: 30, updated_at: "2026-09-17" },
    { slug: "blank", subject: null, image_url: null, price: 10, updated_at: "2026-09-18" },
    { slug: "invitation", subject: "Invitation", image_url: image, price: null, updated_at: "2026-09-19" },
    { slug: "hindu", subject: "Hindu Wedding Card", image_url: null, price: null, updated_at: "2026-09-20" },
    ...[" Shagun Envelopes ", "RAKHI", "wedding box"].map(subject => ({ slug: subject, subject, price: 50, image_url: image })),
  ].map(row => ({ id: row.slug, item_code: row.slug, design_no: row.slug, name: row.slug, images: [], videos: [], tags: [], min_order_qty: 50, order_multiple: 25, group_name: "Supplier", ...row }));
  const { catalog, state } = loadCatalog(rows);
  const base = await catalog.fetchWeddingCardProductsBase();
  assert.deepEqual(Array.from(base, item => item.slug), ["hindi", "common", "invitation", "blank", "hindu"]);
  assert.equal(state.priced, 0);
  state.margin = 20;
  const priced = await catalog.fetchWeddingCardProducts();
  assert.equal(priced.length, 5); assert.equal(priced[0].price, 36);
  assert.deepEqual(Array.from(await catalog.fetchErpProductsByCategory("wedding"), item => item.slug), Array.from(base, item => item.slug));
  assert.equal((await catalog.fetchWeddingCardProductsBase())[0].price, 30); assert.equal(state.reads, 1);
  assert.equal((await catalog.fetchErpProductsBySubject("Hindu Wedding Card")).length, 1);
  assert.equal((await catalog.buildErpProductList()).length, 8, "must not sort or remove from the cached base list");
  assert.equal(catalog.isWeddingCardProduct({ subject: "Christian Wedding Card" }), true);
});

test("wedding filters round-trip through a shareable URL and discard invalid enums", () => {
  const filters = { type: "hindu", text: "Hindi & English", price: "25-50", sort: "price-asc" };
  const serialized = helpers.serializeWeddingFilters(filters);
  assert.match(serialized, /text=Hindi\+%26\+English/);
  assert.deepEqual(plain(helpers.parseWeddingFilters(new URLSearchParams(serialized))), filters);
  assert.deepEqual(plain(helpers.parseWeddingFilters(new URLSearchParams("type=other&price=bad&sort=bad&photos=1"))), plain(helpers.DEFAULT_WEDDING_FILTERS));
  assert.equal(helpers.serializeWeddingFilters(helpers.DEFAULT_WEDDING_FILTERS), "");
});

test("each wedding facet filters the full list, including unassigned subjects only under Any", () => {
  const products = [product, { ...product, slug: "hindu", subject: "Hindu Wedding Card", image: "", price: 70 }, { ...product, slug: "common", subject: "Common", image: "", price: 0 }, { ...product, slug: "blank", subject: "", image: "", price: 10 }];
  const filter = patch => Array.from(helpers.applyWeddingFilters(products, { ...helpers.DEFAULT_WEDDING_FILTERS, ...patch }), item => item.slug);
  assert.deepEqual(filter({ type: "hindu" }), ["hindu"]);
  assert.deepEqual(filter({ text: "Hindi" }), ["111015"]);
  assert.deepEqual(filter({ text: "Hindu Wedding Card" }), []);
  assert.deepEqual(filter({ price: "on-request" }), ["common"]);
  assert.deepEqual(filter({ text: "Hindi", price: "under-25" }), []);
  assert.equal(filter({}).length, 4);
});

test("price sorting puts unpriced items last in both directions without mutating recommended order", () => {
  const products = [product, { ...product, slug: "unpriced", price: 0 }, { ...product, slug: "low", price: 10, updatedAt: "2026-09-18" }, { ...product, slug: "invalid", price: NaN }];
  const sorted = sort => Array.from(helpers.sortWeddingProducts(products, sort), item => item.slug);
  assert.deepEqual(sorted("price-asc"), ["low", "111015", "unpriced", "invalid"]);
  assert.deepEqual(sorted("price-desc"), ["111015", "low", "unpriced", "invalid"]);
  assert.equal(sorted("newest")[0], "low");
  assert.deepEqual(sorted("recommended"), products.map(item => item.slug));
  assert.equal(products[0], product);
});

test("price buckets have non-overlapping boundaries and facets with one option are hidden", () => {
  for (const [price, bucket] of [[0, "on-request"], [-1, "on-request"], [24.99, "under-25"], [25, "25-50"], [49.99, "25-50"], [50, "50-100"], [100, "50-100"], [100.01, "above-100"]]) assert.equal(helpers.priceBucketFor(price), bucket);
  const single = helpers.facetCounts([product]);
  assert.equal(single.showType, false); assert.equal(single.showText, false); assert.equal(single.showPrice, false);
  const varied = helpers.facetCounts([product, { ...product, subject: "Common", price: 0 }, { ...product, subject: "Hindu Wedding Card" }, { ...product, subject: "Muslim Wedding Card" }, { ...product, subject: "" }]);
  assert.equal(varied.showType, true); assert.equal(varied.showText, true); assert.equal(varied.showPrice, true);
  assert.deepEqual(Array.from(varied.text, item => item.label), ["Common", "Hindi"]);
});

async function withBrowser(run, initialQuery = "") {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000/wedding-cards", pretendToBeVisual: true });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const context = React.createContext(null);
  const urls = [];
  let navigate;
  const motion = { revealNew() {}, reorderStart() {}, reorderEnd() {}, expand(el) { el.hidden = false; }, collapse(el) { el.hidden = true; }, openSheet(el, backdrop) { el.hidden = false; backdrop.hidden = false; }, closeSheet(el, backdrop) { el.hidden = true; backdrop.hidden = true; } };
  const imports = {
    react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/wedding-cards": helpers,
    "next/image": ({ fill, priority, ...props }) => React.createElement("img", props),
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { useSearchParams: () => new URLSearchParams(React.useContext(context).query), usePathname: () => "/wedding-cards", useRouter: () => React.useContext(context).router },
    "lucide-react": { SlidersHorizontal: () => null, X: () => null, ChevronDown: () => null },
    "@/components/WishlistButton": ({ productSlug }) => React.createElement("button", { "data-wishlist": productSlug }, "Save"),
    "@/components/AddToCartButton": ({ product }) => React.createElement("button", { "data-cart": product.itemCode }, product.price > 0 ? "Add to Cart" : "Enquire for price"),
    "@/components/ProductPrice": ({ price }) => React.createElement("span", null, price > 0 ? `₹${price}` : "Price on request"),
    "@/components/wedding-cards/WeddingCardsMotion": { WeddingCardsMotion: ({ children }) => children, useWeddingCardsMotion: () => motion },
  };
  const globals = { window: dom.window, document: dom.window.document };
  imports["@/components/wedding-cards/WeddingCardTile"] = load("components/wedding-cards/WeddingCardTile.tsx", imports, globals);
  const Browser = load("components/wedding-cards/WeddingCardsBrowser.tsx", imports, globals).default;
  const products = Array.from({ length: 30 }, (_, index) => ({ ...product, slug: `card-${index}`, designNo: String(index), name: String(index), image: index % 2 ? "" : image, subject: index % 2 ? "Common" : "Hindi", price: index % 2 ? 0 : 25 }));
  function Harness() {
    const [query, setQuery] = React.useState(initialQuery);
    navigate = setQuery;
    const router = { replace(url, options) { assert.equal(options.scroll, false); urls.push(url); setQuery(url.split("?")[1] || ""); } };
    return React.createElement(context.Provider, { value: { query, router } }, React.createElement(Browser, { products }));
  }
  const click = async text => React.act(async () => [...document.querySelectorAll("button")].find(element => element.textContent.startsWith(text)).click());
  try { await React.act(async () => root.render(React.createElement(Harness))); await run({ React, dom, click, urls, navigate: async query => React.act(async () => navigate(query)), imports, globals }); }
  finally { await React.act(async () => root.unmount()); dom.window.close(); delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT; }
}

test("browser renders 24, shows more, filters categories in the URL, and clears back to the first page", async () => withBrowser(async ({ click, urls, navigate }) => {
  assert.equal(document.querySelectorAll("[data-card]").length, 24);
  assert.match(document.querySelector("[data-card]").textContent, /Design 0/);
  await click("Show more"); assert.equal(document.querySelectorAll("[data-card]").length, 30);
  await click("Hindi"); assert.equal(document.querySelectorAll("[data-card]").length, 15); assert.match(urls.at(-1), /text=Hindi/);
  await click("Clear filters"); assert.equal(document.querySelectorAll("[data-card]").length, 24); assert.equal(urls.at(-1), "/wedding-cards");
  await navigate("text=Common&price=on-request"); assert.equal(document.querySelectorAll("[data-card]").length, 15); assert.match(document.querySelector("[data-card]").textContent, /Photo on request/);
  await navigate("text=unknown"); assert.equal(document.querySelectorAll("[data-card]").length, 0); assert.match(document.body.textContent, /No designs match these filters/);
}));

test("initial URL filters and mobile dialog support opening, Escape, and focus return", async () => withBrowser(async ({ React, dom, click }) => {
  assert.equal(document.querySelectorAll("[data-card]").length, 15);
  await click("Filters");
  assert.equal(document.querySelector('[role="dialog"]').hidden, false);
  await React.act(async () => { await new Promise(resolve => dom.window.requestAnimationFrame(resolve)); });
  assert.ok(document.activeElement.hasAttribute("aria-pressed"));
  await React.act(async () => document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(document.querySelector('[role="dialog"]').hidden, true);
  assert.equal(document.activeElement.textContent, "Filters");
}, "text=Hindi"));
