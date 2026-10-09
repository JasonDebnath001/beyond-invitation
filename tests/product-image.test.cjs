const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

function loadComponent(file, overrides = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name in overrides) return overrides[name];
      if (name.startsWith("@/") || name.startsWith("./") || name.startsWith("../")) {
        const target = name.startsWith("@/")
          ? path.resolve(__dirname, "..", name.slice(2))
          : path.resolve(path.dirname(filename), name);
        const resolved = [`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts")].find(fs.existsSync);
        return loadComponent(resolved, overrides);
      }
      return require(name);
    },
  });
  return exports;
}

async function withImages(run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://shop.test" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require("react-dom/client");
  const { ImageConfigContext } = require("next/dist/shared/lib/image-config-context.shared-runtime");
  const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
  const root = createRoot(document.getElementById("root"));
  const render = (element) => React.act(async () => root.render(
    React.createElement(ImageConfigContext.Provider, {
      value: { ...imageConfigDefault, remotePatterns: [{ protocol: "https", hostname: "photos.test" }] },
    }, element),
  ));
  const image = () => document.querySelector("#root img");
  const fail = () => React.act(async () => image().dispatchEvent(new dom.window.Event("error")));
  try {
    await run({ render, image, fail, document });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("an optimizer error retries the original photo before reporting a missing image", () => withImages(async ({ render, image, fail }) => {
  const ProductImage = loadComponent("components/ProductImage.tsx").default;
  let failures = 0;
  const src = "https://photos.test/box.png";
  await render(React.createElement(ProductImage, {
    src, alt: "Wedding box", width: 200, height: 250, className: "object-contain", onError: () => failures++,
  }));
  assert.equal(new URL(image().src).pathname, "/_next/image");
  assert.ok(image().getAttribute("srcset"));
  await fail();
  assert.equal(image().getAttribute("src"), src);
  assert.equal(image().getAttribute("srcset"), null);
  assert.equal(image().alt, "Wedding box");
  assert.equal(image().className, "object-contain");
  assert.equal(image().getAttribute("loading"), "lazy");
  assert.equal(failures, 0);
  await fail();
  assert.equal(failures, 1);
  assert.equal(image().getAttribute("src"), src);
}));

test("a different product starts with optimization and explicitly direct images do not retry", () => withImages(async ({ render, image, fail }) => {
  const ProductImage = loadComponent("components/ProductImage.tsx").default;
  let failures = 0;
  const props = { alt: "Card", width: 200, height: 250, onError: () => failures++ };
  await render(React.createElement(ProductImage, { ...props, src: "https://photos.test/first.png" }));
  await fail();
  assert.equal(image().getAttribute("src"), "https://photos.test/first.png");
  await render(React.createElement(ProductImage, { ...props, src: "https://photos.test/second.png" }));
  assert.equal(new URL(image().src).pathname, "/_next/image");
  assert.ok(image().getAttribute("srcset"));
  await render(React.createElement(ProductImage, { ...props, src: "https://photos.test/direct.png", unoptimized: true }));
  await fail();
  assert.equal(failures, 1);
  assert.equal(image().getAttribute("src"), "https://photos.test/direct.png");
}));

test("a price-on-request collection tile keeps its photo on optimizer failure and shows a placeholder only when the original fails", () => withImages(async ({ render, image, fail, document }) => {
  const Tile = loadComponent("components/wedding-cards/WeddingCardTile.tsx", {
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/components/WishlistButton": () => null,
    "@/components/AddToCartButton": () => null,
  }).default;
  const product = {
    slug: "box-1", designNo: "BOX-1", name: "Wedding box", price: 0, mrp: 150,
    image: "https://photos.test/box-1.png", imageCount: 5, subject: "Wedding Box",
    itemCategory: "Wedding Box", itemGroup: "Boxes", hasPrice: false, minOrderQty: 25, updatedAt: "2026-10-01",
  };
  await render(React.createElement(Tile, { product }));
  assert.ok(image());
  assert.match(document.body.textContent, /Price on request/);
  await fail();
  assert.equal(image().getAttribute("src"), product.image);
  assert.doesNotMatch(document.body.textContent, /Photo on request/);
  assert.match(document.body.textContent, /5 photos/);
  await fail();
  assert.equal(image(), null);
  assert.match(document.body.textContent, /Photo on request/);
}));

test("product cards serve responsive lazy images and retain their original-photo fallback", () => withImages(async ({ render, image, fail, document }) => {
  const ProductCard = loadComponent("components/ProductCard.tsx", {
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "./WishlistButton": () => null,
    "./AddToCartButton": () => null,
  }).default;
  const product = {
    slug: "card-1", name: "Invitation", itemCode: "CARD-1", price: 100, mrp: 150,
    images: ["https://photos.test/card.png"], category: "wedding", description: "", emoji: "",
  };
  const imageSizes = "(min-width:1280px) 212px, 50vw";
  await render(React.createElement(ProductCard, { product, imageSizes }));
  assert.equal(new URL(image().src).pathname, "/_next/image");
  assert.equal(new URL(image().src).searchParams.get("q"), "75");
  assert.equal(image().getAttribute("loading"), "lazy");
  assert.equal(image().getAttribute("sizes"), imageSizes);
  assert.ok(image().getAttribute("srcset"));
  assert.match(image().className, /object-contain/);
  assert.equal(image().style.position, "absolute");
  assert.match(image().parentElement.className, /aspect-square/);
  assert.equal(image().alt, "Invitation (CARD-1)");
  await fail();
  assert.equal(image().getAttribute("src"), product.images[0]);
  assert.doesNotMatch(document.body.textContent, /Image coming soon/);
  await fail();
  assert.equal(image(), null);
  assert.match(document.body.textContent, /Image coming soon/);

  await render(React.createElement(ProductCard, {
    product: { ...product, images: ["http://legacy.test/card.png"] },
  }));
  assert.equal(image().getAttribute("src"), "http://legacy.test/card.png");
  assert.equal(image().getAttribute("srcset"), null);
  await fail();
  assert.equal(image(), null);
}));
