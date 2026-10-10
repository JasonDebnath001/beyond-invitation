const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");

function loader(overrides = {}) {
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
      exports, URL, console, process: { env: { NEXT_PUBLIC_SITE_URL: "https://shop.test" } },
      require(name) {
        if (name in overrides) return overrides[name];
        if (name.startsWith("@/") || name.startsWith("./")) {
          const target = name.startsWith("@/")
            ? path.resolve(__dirname, "..", name.slice(2))
            : path.resolve(path.dirname(filename), name);
          const resolved = [`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")]
            .find((candidate) => fs.existsSync(candidate));
          assert.ok(resolved, `Unable to resolve ${name}`);
          return load(resolved);
        }
        return require(name);
      },
    };
    vm.runInThisContext(`(function(${Object.keys(scope).join(",")}) {\n${code}\n})`, { filename })(...Object.values(scope));
    return exports;
  }
  return load;
}

const product = (extra = {}) => ({
  slug: "ivory-card", name: "Ivory invitation", price: 85, mrp: 100,
  images: ["https://photos.test/ivory.webp"], videos: [], emoji: "",
  category: "wedding", description: "Ivory and gold invitation", itemCode: "IV-1",
  subject: "Wedding Card", ...extra,
});

const ProductGallery = () => null;
const ProductPrice = () => null;
const ProductBuyBox = () => null;
const ProductGrid = () => null;
const params = () => ({ params: Promise.resolve({ slug: "ivory-card" }) });

function fixture({ current = product(), related = async () => [] } = {}) {
  const lookups = [];
  const relatedLookups = [];
  const notFoundError = new Error("NEXT_NOT_FOUND");
  const page = loader({
    "next/navigation": { notFound() { throw notFoundError; } },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/lib/catalog": {
      async fetchErpProductBySlug(slug) { lookups.push(slug); return current; },
      async fetchRelatedErpProducts(...args) { relatedLookups.push(args); return related(...args); },
    },
    "@/components/siteConfig": { BRAND: "Beyond Invitation" },
    "@/lib/site-config": { BRAND_NAME: "Beyond Invitation" },
    "@/components/ProductGrid": { ProductGrid },
    "@/components/ProductGallery": ProductGallery,
    "@/components/ProductBuyBox": ProductBuyBox,
    "@/components/ProductPrice": ProductPrice,
    "@/components/WishlistButton": () => null,
  })("app/products/[slug]/page.tsx");
  return { ...page, lookups, relatedLookups, notFoundError };
}

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elements(tree.props.children)];
}

function relatedBoundary(tree) {
  const boundary = elements(tree).find((element) => element.type === React.Suspense);
  assert.ok(boundary, "recommendations must have their own Suspense boundary");
  return boundary;
}

function invokeRelated(tree) {
  const child = React.Children.only(relatedBoundary(tree).props.children);
  assert.equal(typeof child.type, "function");
  return child.type(child.props);
}

function jsonScripts(tree) {
  return elements(tree)
    .filter((element) => element.props.data?.["@context"] === "https://schema.org")
    .map((element) => {
      const script = element.type(element.props);
      assert.equal(script.type, "script");
      assert.equal(script.props.type, "application/ld+json");
      const source = script.props.dangerouslySetInnerHTML.__html;
      return { source, data: JSON.parse(source) };
    });
}

test("product details resolve with their gallery, price and purchase controls while recommendations are stalled", async () => {
  const current = product();
  const page = fixture({ current, related: () => new Promise(() => {}) });
  const stalled = Symbol("still waiting");
  const tree = await Promise.race([
    page.default(params()),
    new Promise((resolve) => setImmediate(() => resolve(stalled))),
  ]);
  assert.notEqual(tree, stalled, "the main page must not await related products");
  assert.deepEqual(page.lookups, [current.slug]);
  const nodes = elements(tree);
  assert.deepEqual(nodes.find(({ type }) => type === ProductGallery).props.images, current.images);
  assert.equal(nodes.find(({ type }) => type === ProductPrice).props.price, current.price);
  assert.equal(nodes.find(({ type }) => type === ProductPrice).props.mrp, current.mrp);
  assert.equal(nodes.find(({ type }) => type === ProductBuyBox).props.product, current);
  assert.match(nodes.find(({ type }) => type === "h1").props.children, /Ivory invitation/);
  assert.ok(relatedBoundary(tree).props.fallback, "provide feedback while recommendations load");
  const schemas = jsonScripts(tree).map(({ data }) => data);
  assert.equal(schemas.find((schema) => schema["@type"] === "Product").offers.price, current.price);
  assert.ok(schemas.some((schema) => schema["@type"] === "BreadcrumbList"));
  assert.equal(schemas.some((schema) => schema["@type"] === "ItemList"), false);
  assert.equal(page.relatedLookups.length, 0, "the main component leaves recommendation rendering to Suspense");
  const relatedResult = invokeRelated(tree);
  const resolution = await Promise.race([
    relatedResult,
    new Promise((resolve) => setImmediate(() => resolve(stalled))),
  ]);
  assert.equal(resolution, stalled, "the stalled fetch belongs only to the related section");
  assert.equal(page.relatedLookups.length, 1);
});

test("resolved recommendations render their grid and matching JSON-LD inside the deferred section", async () => {
  const recommendations = [
    product({ slug: "rose-card", name: "Rose </script> invitation" }),
    product({ slug: "gold-card", name: "Gold invitation" }),
  ];
  const page = fixture({ related: async () => recommendations });
  const tree = await page.default(params());
  const section = await invokeRelated(tree);
  assert.equal(page.relatedLookups[0][0].slug, "ivory-card");
  assert.equal(page.relatedLookups[0][0].category, "wedding");
  const nodes = elements(section);
  assert.deepEqual(nodes.find(({ type }) => type === ProductGrid).props.products, recommendations);
  assert.ok(nodes.some(({ type, props }) => type === "h2" && /You May Also Like/.test(props.children)));
  const [{ source, data }] = jsonScripts(section);
  assert.equal(data["@type"], "ItemList");
  assert.deepEqual(data.itemListElement.map(({ position, url, name }) => ({ position, url, name })), [
    { position: 1, url: "https://shop.test/products/rose-card", name: recommendations[0].name },
    { position: 2, url: "https://shop.test/products/gold-card", name: recommendations[1].name },
  ]);
  assert.doesNotMatch(source, /<\/script>/i, "product names must not break out of the structured-data script");
});

test("empty or unavailable recommendations omit the section without losing the product page", async () => {
  for (const related of [async () => [], async () => { throw new Error("catalogue offline"); }]) {
    const page = fixture({ related });
    const tree = await page.default(params());
    assert.ok(elements(tree).some(({ type }) => type === ProductBuyBox));
    assert.equal(await invokeRelated(tree), null);
  }
});

test("metadata still describes the selected product and its current visitor price without fetching recommendations", async () => {
  const current = product({ price: 92 });
  const page = fixture({ current });
  const metadata = await page.generateMetadata(params());
  assert.match(metadata.title, /Ivory invitation/);
  assert.equal(metadata.alternates.canonical, "https://shop.test/products/ivory-card");
  assert.equal(metadata.other["product:price:amount"], "92");
  assert.equal(metadata.other["product:price:currency"], "INR");
  assert.equal(metadata.openGraph.images[0].url, current.images[0]);
  assert.equal(metadata.robots.index, true);
  assert.deepEqual(page.lookups, [current.slug]);
  assert.equal(page.relatedLookups.length, 0);
});

test("missing products still use notFound and non-indexable metadata without requesting recommendations", async () => {
  const page = fixture({ current: null });
  await assert.rejects(page.default(params()), (error) => error === page.notFoundError);
  const metadata = await page.generateMetadata(params());
  assert.match(metadata.title, /Product Not Found/);
  assert.equal(metadata.robots.index, false);
  assert.equal(page.relatedLookups.length, 0);
});
