const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

function loadComponent(file) {
  const filename = path.resolve(__dirname, "..", file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    URL,
    require(name) {
      if (name.startsWith("@/")) return loadComponent(`${name.slice(2)}.tsx`);
      return require(name);
    },
  });
  return exports;
}

async function withGallery(props, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://shop.test" });
  const globals = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(global, name)]));
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const { createRoot } = require("react-dom/client");
  const { ImageConfigContext } = require("next/dist/shared/lib/image-config-context.shared-runtime");
  const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
  const Gallery = loadComponent("components/ProductGallery.tsx").default;
  const root = createRoot(document.getElementById("root"));
  const main = () => document.querySelector('img[alt="Wedding invitation"]');
  const click = (label) => React.act(async () => {
    const button = document.querySelector(`button[aria-label="${label}"]`);
    assert.ok(button, `Missing button: ${label}`);
    button.click();
  });
  const fail = (element) => React.act(async () => element.dispatchEvent(new dom.window.Event("error")));
  try {
    await React.act(async () => root.render(React.createElement(ImageConfigContext.Provider, {
      value: { ...imageConfigDefault, ...require("../next.config.js").images, remotePatterns: [{ protocol: "https", hostname: "photos.test" }] },
    }, React.createElement(Gallery, { alt: "Wedding invitation", emoji: "Fallback", ...props }))));
    await run({ document, window: dom.window, main, click, fail });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const name of globals) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(global, name, descriptor);
      else delete global[name];
    }
  }
}

const first = "https://photos.test/front.png";
const second = "https://photos.test/back.png";
const source = (image) => new URL(image.src).searchParams.get("url");

test("gallery prioritizes only the active photo and requests small lazy thumbnails", () => withGallery({ images: [first, second] }, async ({ document, main, click }) => {
  assert.equal(source(main()), first);
  assert.equal(main().getAttribute("loading"), "eager");
  assert.equal(main().getAttribute("fetchpriority"), "high");
  assert.equal(new URL(main().src).searchParams.get("q"), "80");
  assert.ok(main().getAttribute("srcset"));
  assert.match(main().getAttribute("sizes"), /100vw - 32px/);
  assert.equal(main().style.position, "absolute");
  assert.match(main().className, /object-contain/);
  const thumbnails = [...document.querySelectorAll('img[alt*="thumbnail"]')];
  assert.equal(thumbnails.length, 4, "Both responsive thumbnail rows remain available");
  for (const thumbnail of thumbnails) {
    const url = new URL(thumbnail.src);
    assert.equal(url.pathname, "/_next/image");
    assert.ok(Number(url.searchParams.get("w")) <= 256);
    assert.equal(url.searchParams.get("q"), "75");
    assert.equal(thumbnail.getAttribute("loading"), "lazy");
    assert.equal(thumbnail.getAttribute("width"), "96");
    assert.equal(thumbnail.getAttribute("height"), "96");
  }
  assert.equal(document.querySelector('img[src="https://photos.test/front.png"]'), null);
  assert.equal(document.querySelector('[style*="background-image"]'), null, "Original-resolution zoom waits for interaction");
  await click("View image 2");
  assert.equal(source(main()), second);
  assert.equal(main().getAttribute("loading"), "eager");
  assert.equal(main().getAttribute("fetchpriority"), "auto");
  assert.match(document.body.textContent, /2 \/ 2/);
  await click("Previous media");
  assert.equal(source(main()), first);
}));

test("gallery retries originals before removing failed media and preserves the selected photo when a thumbnail fails", () => withGallery({ images: [first, second, "https://photos.test/third.png"] }, async ({ document, main, fail }) => {
  const thumbnail = document.querySelector('img[alt="Wedding invitation thumbnail 3"]');
  await fail(thumbnail);
  const directThumbnail = document.querySelector('img[alt="Wedding invitation thumbnail 3"]');
  assert.equal(directThumbnail.getAttribute("src"), "https://photos.test/third.png");
  await fail(directThumbnail);
  assert.equal(source(main()), first);
  assert.match(document.body.textContent, /1 \/ 2/);
  await fail(main());
  assert.equal(main().getAttribute("src"), first);
  assert.match(document.body.textContent, /1 \/ 2/);
  await fail(main());
  assert.equal(source(main()), second);
  assert.equal(document.querySelector('[aria-label="Product media thumbnails"]'), null);
  await fail(main());
  await fail(main());
  assert.equal(main(), null);
  assert.match(document.body.textContent, /Fallback/);
}));

test("photos retain catalogue order and video resources mount only after selection", () => withGallery({
  images: [first, "https://photos.test/clip.mp4", second, first, "https://photos.test/private/files/secret.png"],
  videos: ["https://photos.test/clip.mp4", "https://youtu.be/abcDEF12345", "https://www.youtube.com/watch?v=abcDEF12345", "https://photos.test/files/video-upload"],
}, async ({ document, main, click }) => {
  const buttons = [...document.querySelector('[aria-label="Product media thumbnails"]').querySelectorAll("button")];
  assert.deepEqual(buttons.map((button) => button.getAttribute("aria-label")), ["View image 1", "View image 2", "View video 3", "View video 4", "View video 5"]);
  assert.equal(source(main()), first);
  assert.equal(document.querySelector("video, iframe"), null);
  assert.equal(document.querySelector('[src*="clip.mp4"]'), null);
  assert.equal(document.querySelector('[src*="secret.png"]'), null);
  await click("View image 2");
  assert.equal(source(main()), second);
  await click("View video 3");
  const video = document.querySelector("video");
  assert.equal(main(), null);
  assert.equal(video.getAttribute("src"), "https://photos.test/clip.mp4");
  assert.equal(video.preload, "metadata");
  assert.equal(video.autoplay, true);
  assert.equal(video.muted, true);
  assert.equal(video.loop, true);
  assert.equal(video.playsInline, true);
  await click("View video 4");
  assert.equal(document.querySelector("video"), null);
  assert.equal(new URL(document.querySelector("iframe").src).pathname, "/embed/abcDEF12345");
  await click("View video 5");
  assert.equal(document.querySelector("iframe"), null);
  assert.equal(document.querySelector("video").getAttribute("src"), "https://photos.test/files/video-upload");
  await click("View image 1");
  assert.equal(document.querySelector("video, iframe"), null);
}));

test("zoom still uses loaded image dimensions and requests the detailed original only on hover", () => withGallery({ images: [first] }, async ({ document, window, main }) => {
  const image = main();
  const stage = image.parentElement;
  // JSDOM does not apply Tailwind or calculate the rendered image dimensions.
  stage.style.position = "relative";
  Object.defineProperties(image, {
    naturalWidth: { value: 400 }, naturalHeight: { value: 800 },
    width: { value: 250 }, height: { value: 500 },
  });
  await React.act(async () => image.dispatchEvent(new window.Event("load")));
  stage.getBoundingClientRect = () => ({ width: 400, height: 500, left: 0, top: 0 });
  await React.act(async () => stage.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true, clientX: 10, clientY: 250 })));
  assert.equal(document.querySelector('[style*="background-image"]'), null, "Letterbox space does not activate zoom");
  await React.act(async () => stage.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true, clientX: 200, clientY: 250 })));
  const zoom = document.querySelector('[style*="background-image"]');
  assert.ok(zoom);
  assert.ok(zoom.style.backgroundImage.includes(first));
  assert.equal(zoom.style.backgroundPosition, "50% 50%");
  await React.act(async () => stage.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })));
  assert.equal(document.querySelector('[style*="background-image"]'), null);
}));
