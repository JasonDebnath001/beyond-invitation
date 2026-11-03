const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
const { renderToStaticMarkup } = require("react-dom/server");

function loadComponent(file, additionalImports = {}) {
  const imports = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-dom": require("react-dom"),
    "lucide-react": require("lucide-react"),
    ...additionalImports,
  };
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports.default;
}

const imageImport = { __esModule: true, default: ({ src, alt, onError, onLoad, style, "aria-hidden": ariaHidden }) => React.createElement("img", { src, alt, onError, onLoad, style, "aria-hidden": ariaHidden }) };
const Thumbnail = loadComponent("components/ProductVideoThumbnail.tsx", { "@/components/ProductImage": imageImport });
const thumbnailImport = { __esModule: true, default: Thumbnail };
const Video = loadComponent("components/ProductGalleryVideo.tsx", { "@/components/ProductVideoThumbnail": thumbnailImport });
const Gallery = loadComponent("components/ProductGallery.tsx", {
  "@/components/ProductGalleryVideo": { __esModule: true, default: Video },
  "@/components/ProductVideoThumbnail": thumbnailImport,
  "@/components/ProductImage": imageImport,
});

const originalFetch = global.fetch;
global.fetch = async () => ({ ok: true, json: async () => ({ thumbnail_url: "https://i.vimeocdn.com/video/test.jpg" }) });
after(() => { dom.window.close(); global.fetch = originalFetch; });

test("photos and deduplicated videos share one slide sequence, including video-only products", () => {
  const render = (props) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderToStaticMarkup(React.createElement(Gallery, { emoji: "", alt: "Card", ...props }));
    return wrapper;
  };
  const gallery = render({ images: ["/front.jpg", "/inside.jpg", "/files/demo.mp4", "/private/files/hidden.jpg"], videos: ["/files/demo.mp4", "/files/extensionless"] });
  const track = gallery.querySelector('[aria-label="Product media"]');
  assert.equal(track.children.length, 4);
  assert.deepEqual([...track.children].map((slide) => slide.querySelector("video") ? "video" : "photo"), ["photo", "photo", "video", "video"]);
  assert.equal(track.querySelectorAll("video").length, 2);
  assert.ok(!gallery.querySelector('img[src*="hidden.jpg"]'));
  const videoOnly = render({ images: [], videos: ["/files/demo.webm"] });
  assert.equal(videoOnly.querySelector('[aria-label="Product media"]').children.length, 1);
  assert.ok(videoOnly.querySelector("video"));
});

async function mountGallery(props, mobile = false) {
  window.matchMedia = (query) => ({ matches: query.includes("max-width") ? mobile : !mobile, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  global.IntersectionObserver = window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  window.HTMLMediaElement.prototype.pause = function () {};
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Gallery, { emoji: "", alt: "Card", ...props })));
  return {
    container,
    close: async () => { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("desktop gallery fits the available viewport and keeps its size stable when scrolled", async () => {
  const heightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight");
  const scrollDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const originalBounds = window.HTMLElement.prototype.getBoundingClientRect;
  const originalObserver = global.ResizeObserver;
  let viewportHeight = 900;
  let scrollY = 0;
  let documentTop = 172;
  let observer;
  let fixture;
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => viewportHeight });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.getAttribute("aria-label") === "Product photos and videos") {
      return { left: 0, top: documentTop - scrollY, width: 680, height: 700, right: 680, bottom: documentTop - scrollY + 700 };
    }
    return originalBounds.call(this);
  };
  global.ResizeObserver = class {
    constructor(callback) { observer = this; this.callback = callback; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  };
  try {
    fixture = await mountGallery({ images: ["/portrait.jpg"] });
    const gallery = fixture.container.querySelector('[aria-label="Product photos and videos"]');
    const availableHeight = () => gallery.style.getPropertyValue("--product-media-max-height");
    assert.equal(availableHeight(), "712px", "The full image must fit below the actual header and breadcrumb");
    assert.equal(observer.target, gallery);

    viewportHeight = 760;
    await React.act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.equal(availableHeight(), "572px", "Shorter desktop windows reduce the image height limit");
    scrollY = 120;
    await React.act(async () => observer.callback());
    assert.equal(availableHeight(), "572px", "Scrolling must not enlarge the image and push its bottom out of view");
    documentTop = 190;
    await React.act(async () => observer.callback());
    assert.equal(availableHeight(), "554px", "Layout changes above the gallery update the available space");

    await fixture.close();
    fixture = null;
    assert.ok(observer.disconnected);
    viewportHeight = 700;
    await React.act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.equal(availableHeight(), "554px", "Unmounting removes the resize listener");

    fixture = await mountGallery({ images: ["/portrait.jpg"] }, true);
    const mobileGallery = fixture.container.querySelector('[aria-label="Product photos and videos"]');
    assert.equal(mobileGallery.style.getPropertyValue("--product-media-max-height"), "");
    viewportHeight = 600;
    await React.act(async () => window.dispatchEvent(new window.Event("resize")));
    assert.equal(mobileGallery.style.getPropertyValue("--product-media-max-height"), "", "Mobile keeps its existing uncapped swipe gallery");
  } finally {
    if (fixture) await fixture.close();
    Object.defineProperty(window, "innerHeight", heightDescriptor);
    Object.defineProperty(window, "scrollY", scrollDescriptor);
    window.HTMLElement.prototype.getBoundingClientRect = originalBounds;
    if (originalObserver === undefined) delete global.ResizeObserver;
    else global.ResizeObserver = originalObserver;
  }
});

test("thumbnail selection chooses photos and video without replacing the mobile slide sequence", async () => {
  const fixture = await mountGallery({ images: ["/front.jpg", "/inside.jpg"], videos: ["/files/demo.mp4"] });
  try {
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const thumbnails = fixture.container.querySelector('[aria-label="Choose product media"]');
    assert.ok(thumbnails);
    const slides = [...track.children];
    const buttons = [...thumbnails.querySelectorAll("button")];
    const selectedButton = () => thumbnails.querySelector('[aria-pressed="true"]');
    assert.equal(buttons.length, 3);
    assert.equal(selectedButton().getAttribute("aria-label"), "Show photo 1 of Card");
    for (const [index, button] of buttons.entries()) {
      assert.equal(button.type, "button");
      assert.equal(document.getElementById(button.getAttribute("aria-controls")), slides[index]);
    }

    await React.act(async () => buttons[1].click());
    assert.equal(selectedButton().getAttribute("aria-label"), "Show photo 2 of Card");
    assert.equal(buttons[0].getAttribute("aria-pressed"), "false");
    assert.equal(thumbnails.querySelectorAll('[aria-pressed="true"]').length, 1);

    const video = track.querySelector("video");
    await React.act(async () => buttons[2].click());
    assert.equal(selectedButton().getAttribute("aria-label"), "Show video 1 of Card");
    assert.equal(buttons[1].getAttribute("aria-pressed"), "false");
    assert.equal(track.querySelectorAll("video").length, 1, "One playback video remains in the mobile slide sequence");
    const preview = buttons[2].querySelector("video");
    assert.ok(preview, "Video thumbnails show a static frame from the video");
    assert.equal(preview.autoplay, false);
    assert.equal(preview.controls, false);
    assert.ok(buttons[2].querySelector("svg"), "A small play glyph identifies the video thumbnail");
    assert.ok(!buttons[0].querySelector("svg"), "Photo thumbnails have no play glyph");
    assert.ok(!track.querySelector("svg"), "The main video remains free of play overlays");
    assert.ok(!track.querySelector("button"), "Main photos and videos have no lightbox or playback button");
    assert.equal(track.querySelector("video"), video);
    assert.equal(fixture.container.querySelectorAll('[aria-label="Product media"]').length, 1);
    assert.deepEqual([...track.children], slides, "All photos and videos remain mounted in the original mobile swipe order");
    assert.ok(!document.querySelector("dialog"), "Selecting a thumbnail changes the main media without opening the lightbox");
  } finally { await fixture.close(); }
});

test("gallery width follows only the active media's cached dimensions, including fallback to one remaining photo", async () => {
  const fixture = await mountGallery({ images: ["/portrait.jpg", "/landscape.jpg"], videos: ["/files/demo.mp4"] });
  try {
    const gallery = fixture.container.querySelector('[aria-label="Product photos and videos"]');
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const aspect = () => Number(gallery.style.getPropertyValue("--product-gallery-aspect-ratio"));
    const loadPhoto = async (src, width, height) => {
      const photo = track.querySelector(`img[src="${src}"]`);
      Object.defineProperty(photo, "naturalWidth", { configurable: true, value: width });
      Object.defineProperty(photo, "naturalHeight", { configurable: true, value: height });
      await React.act(async () => photo.dispatchEvent(new window.Event("load")));
    };
    await loadPhoto("/portrait.jpg", 1200, 1800);
    assert.equal(aspect(), 2 / 3);
    await loadPhoto("/landscape.jpg", 1200, 800);
    assert.equal(aspect(), 2 / 3, "Loading an inactive photo must not resize the selected media column");

    const video = track.querySelector("video");
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 720 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 1280 });
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.equal(aspect(), 2 / 3, "An inactive video's metadata cannot resize the selected photo");

    await React.act(async () => fixture.container.querySelector('[aria-label="Show photo 2 of Card"]').click());
    assert.equal(aspect(), 3 / 2, "Selecting a loaded photo immediately uses its cached dimensions");
    await React.act(async () => fixture.container.querySelector('[aria-label="Show video 1 of Card"]').click());
    assert.equal(aspect(), 9 / 16, "Selecting a loaded video immediately uses its cached dimensions");

    await React.act(async () => video.dispatchEvent(new window.Event("error")));
    assert.equal(aspect(), 2 / 3, "A failed selected video falls back to the first valid photo's dimensions");
    await React.act(async () => track.querySelector('img[src="/portrait.jpg"]').dispatchEvent(new window.Event("error")));
    assert.equal(track.children.length, 1);
    assert.equal(aspect(), 3 / 2, "The remaining single image retains its own proportional width");
    assert.ok(!fixture.container.querySelector('[aria-label="Choose product media"]'));
  } finally { await fixture.close(); }
});

test("a failed selected photo falls back to a valid photo and an empty gallery stays usable", async () => {
  const fixture = await mountGallery({ images: ["/front.jpg", "/inside.jpg", "/back.jpg"] });
  try {
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const thumbnails = () => fixture.container.querySelector('[aria-label="Choose product media"]');
    await React.act(async () => thumbnails().querySelector('[aria-label="Show photo 2 of Card"]').click());
    await React.act(async () => track.querySelector('img[src="/inside.jpg"]').dispatchEvent(new window.Event("error")));

    assert.equal(track.children.length, 2);
    assert.ok(!fixture.container.querySelector('img[src="/inside.jpg"]'));
    const fallback = thumbnails().querySelector('[aria-pressed="true"]');
    assert.equal(fallback.getAttribute("aria-label"), "Show photo 1 of Card");
    assert.equal(document.getElementById(fallback.getAttribute("aria-controls")), track.children[0]);
    assert.equal(track.children[0].querySelector("img").getAttribute("src"), "/front.jpg");

    await React.act(async () => thumbnails().querySelector('[aria-label="Show photo 2 of Card"]').click());
    const nextChoice = thumbnails().querySelector('[aria-pressed="true"]');
    assert.equal(document.getElementById(nextChoice.getAttribute("aria-controls")).querySelector("img").getAttribute("src"), "/back.jpg");

    for (const src of ["/front.jpg", "/back.jpg"]) {
      await React.act(async () => track.querySelector(`img[src="${src}"]`).dispatchEvent(new window.Event("error")));
    }
    assert.ok(!fixture.container.querySelector('[aria-label="Product media"]'));
    assert.ok(!thumbnails());
    assert.match(fixture.container.querySelector('[role="status"]').textContent, /Product photos are currently unavailable/);
  } finally { await fixture.close(); }
});

async function mountVideo(props = {}, mobile = true) {
  let hidden = false;
  let observer;
  const listeners = new Set();
  const query = {
    get matches() { return mobile; },
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  window.matchMedia = (text) => text.includes("max-width") ? query : {
    get matches() { return !mobile; },
    addEventListener: query.addEventListener,
    removeEventListener: query.removeEventListener,
  };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  global.IntersectionObserver = window.IntersectionObserver = class {
    constructor(callback) { observer = this; this.callback = callback; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    emit(width, height) {
      this.callback([{ isIntersecting: width > 0 && height > 0, boundingClientRect: { width: 400, height: 1200 }, intersectionRect: { width, height } }]);
    }
  };
  let plays = 0;
  let pauses = 0;
  const playing = new WeakMap();
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get() { return !playing.get(this); },
  });
  window.HTMLMediaElement.prototype.play = function () {
    plays++;
    playing.set(this, true);
    this.dispatchEvent(new window.Event("play"));
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {
    pauses++;
    if (playing.get(this)) {
      playing.set(this, false);
      this.dispatchEvent(new window.Event("pause"));
    }
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current = { src: "/files/demo.mp4", kind: "native", label: "Card video", active: true, onError() {}, ...props };
  const render = async (changes = {}) => {
    current = { ...current, ...changes };
    await React.act(async () => root.render(React.createElement(Video, current)));
  };
  await render();
  return {
    container, render,
    plays: () => plays,
    pauses: () => pauses,
    visible: async (width, height) => React.act(async () => observer.emit(width, height)),
    hidden: async (value) => React.act(async () => { hidden = value; document.dispatchEvent(new window.Event("visibilitychange")); }),
    mobile: async (value) => React.act(async () => { mobile = value; listeners.forEach((listener) => listener()); }),
    close: async () => { await React.act(async () => root.unmount()); assert.ok(observer.disconnected); container.remove(); },
  };
}

test("mobile video autoplays only in the visible slide without controls, independent of desktop selection", async () => {
  const fixture = await mountVideo({ active: false });
  try {
    assert.equal(fixture.plays(), 0);
    await fixture.visible(100, 600);
    assert.equal(fixture.plays(), 0, "The edge of an adjacent slide must not autoplay");
    await fixture.visible(400, 500);
    const video = fixture.container.querySelector("video");
    assert.ok(fixture.plays() > 0, "A tall portrait video can autoplay without fitting the screen");
    assert.equal(video.paused, false);
    assert.ok(video.muted);
    assert.ok(video.playsInline);
    assert.equal(video.controls, false);
    assert.ok(!fixture.container.querySelector("button, input, svg"));
    await fixture.visible(0, 0);
    assert.equal(video.paused, true);
    await fixture.visible(400, 500);
    assert.equal(video.paused, false);
    await fixture.hidden(true);
    assert.equal(video.paused, true);
    await fixture.hidden(false);
    assert.equal(video.paused, false);
  } finally { await fixture.close(); }
});

test("desktop video autoplays on selection and pauses on deselection, leaving view, or a hidden tab", async () => {
  const fixture = await mountVideo({ active: false }, false);
  try {
    const video = fixture.container.querySelector("video");
    await fixture.visible(400, 500);
    assert.equal(fixture.plays(), 0, "An unselected video must not start");
    await fixture.render({ active: true });
    assert.equal(video.paused, false);
    assert.ok(video.muted);
    assert.ok(video.playsInline);
    assert.ok(video.loop);
    assert.equal(video.controls, false);
    assert.ok(!fixture.container.querySelector("button, input, svg"));
    await fixture.render({ active: false });
    assert.equal(video.paused, true);
    await React.act(async () => video.play());
    assert.equal(video.paused, true, "A late play event must not revive a deselected video");
    await fixture.render({ active: true });
    assert.equal(video.paused, false);
    await fixture.visible(0, 0);
    assert.equal(video.paused, true);
    await fixture.visible(400, 500);
    assert.equal(video.paused, false);
    await fixture.hidden(true);
    assert.equal(video.paused, true);
    await fixture.hidden(false);
    assert.equal(video.paused, false);
    await fixture.render({ active: false });
    await fixture.mobile(true);
    assert.equal(video.paused, false, "Mobile follows the visible slide, independent of desktop selection");
    await fixture.mobile(false);
    assert.equal(video.paused, true, "Returning to desktop restores selection gating");
  } finally { await fixture.close(); }
});

test("cached photo and video dimensions are recovered without load or metadata events", async () => {
  const properties = [
    [window.HTMLImageElement.prototype, "complete", () => true],
    [window.HTMLImageElement.prototype, "naturalWidth", () => 1200],
    [window.HTMLImageElement.prototype, "naturalHeight", () => 1800],
    [window.HTMLMediaElement.prototype, "readyState", () => 3],
    [window.HTMLVideoElement.prototype, "videoWidth", () => 1080],
    [window.HTMLVideoElement.prototype, "videoHeight", () => 1920],
  ];
  const originals = properties.map(([prototype, property]) => Object.getOwnPropertyDescriptor(prototype, property));
  let fixture;
  try {
    for (const [prototype, property, get] of properties) {
      Object.defineProperty(prototype, property, { configurable: true, get });
    }
    fixture = await mountGallery({ images: ["/cached-portrait.jpg"], videos: ["/files/cached.mp4"] });
    const gallery = fixture.container.querySelector('[aria-label="Product photos and videos"]');
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const photo = track.querySelector("img");
    const video = track.querySelector("video");
    const aspect = () => Number(gallery.style.getPropertyValue("--product-gallery-aspect-ratio"));
    assert.equal(Number(photo.parentElement.style.getPropertyValue("--product-media-aspect-ratio")), 2 / 3);
    assert.equal(aspect(), 2 / 3, "An already-complete photo sizes the gallery without another load event");
    assert.equal(Number(video.parentElement.style.getPropertyValue("--product-media-aspect-ratio")), 9 / 16);
    await React.act(async () => fixture.container.querySelector('[aria-label="Show video 1 of Card"]').click());
    assert.equal(aspect(), 9 / 16, "Selecting a preloaded video uses existing metadata without waiting for a new event");
    await React.act(async () => fixture.container.querySelector('[aria-label="Show photo 1 of Card"]').click());
    assert.equal(aspect(), 2 / 3);
  } finally {
    if (fixture) await fixture.close();
    for (const [index, [prototype, property]] of properties.entries()) {
      if (originals[index]) Object.defineProperty(prototype, property, originals[index]);
      else delete prototype[property];
    }
  }
});

test("photos and playing videos share aspect-based sizing regardless of pixel resolution", async () => {
  let photoAspect;
  const gallery = await mountGallery({ images: ["/portrait.jpg"] });
  try {
    const photo = gallery.container.querySelector('[aria-label="Product media"] img');
    Object.defineProperty(photo, "naturalWidth", { configurable: true, value: 1200 });
    Object.defineProperty(photo, "naturalHeight", { configurable: true, value: 1800 });
    await React.act(async () => photo.dispatchEvent(new window.Event("load")));
    photoAspect = Number(photo.parentElement.style.getPropertyValue("--product-media-aspect-ratio"));
    assert.equal(photoAspect, 2 / 3);
  } finally { await gallery.close(); }

  const fixture = await mountVideo({}, false);
  try {
    const video = fixture.container.querySelector("video");
    const aspect = () => Number(video.parentElement.style.getPropertyValue("--product-media-aspect-ratio"));
    let dimensions = { width: 320, height: 480 };
    let readyState = 0;
    Object.defineProperty(video, "videoWidth", { configurable: true, get: () => dimensions.width });
    Object.defineProperty(video, "videoHeight", { configurable: true, get: () => dimensions.height });
    Object.defineProperty(video, "readyState", { configurable: true, get: () => readyState });
    await fixture.visible(400, 500);
    assert.equal(video.paused, false);
    video.currentTime = 5;
    readyState = 1;
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.equal(aspect(), photoAspect, "A lower-resolution video uses the same sizing ratio as the photo");
    assert.equal(video.paused, false, "Measuring the video must not stop autoplay");
    assert.equal(video.currentTime, 5, "Metadata during playback must not seek back to the preview frame");

    readyState = 0;
    dimensions = { width: 0, height: 0 };
    await fixture.render({ src: "/files/landscape.mp4" });
    assert.equal(aspect(), 1, "A changed source cannot inherit the previous portrait ratio");
    readyState = 1;
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.equal(aspect(), 1, "Incomplete metadata keeps a finite fallback ratio");
    dimensions = { width: 1280, height: 720 };
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.equal(aspect(), 16 / 9);
    dimensions = { width: 1280, height: 0 };
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.equal(aspect(), 16 / 9, "Invalid later metadata cannot overwrite the last valid ratio");
  } finally { await fixture.close(); }
});

test("embedded players mount only for playback and unload instead of showing idle play controls", async () => {
  for (const src of ["https://player.vimeo.com/video/123?autoplay=0&controls=1", "https://www.youtube.com/embed/test-video?autoplay=0&controls=1"]) {
    const fixture = await mountVideo({ kind: "embed", src, active: false, poster: "/front.jpg" }, false);
    try {
      assert.ok(!fixture.container.querySelector("iframe"));
      await fixture.visible(400, 500);
      assert.ok(!fixture.container.querySelector("iframe"));
      await fixture.render({ active: true });
      const frame = fixture.container.querySelector("iframe");
      const url = new URL(frame.src);
      assert.equal(url.searchParams.get("autoplay"), "1");
      assert.equal(url.searchParams.get("controls"), "0");
      assert.equal(url.searchParams.get("muted"), "1");
      assert.ok(!fixture.container.querySelector("button, input, svg"));
      await fixture.render({ active: false });
      assert.ok(!fixture.container.querySelector("iframe"));
      assert.ok(!frame.isConnected);
      await fixture.render({ active: true });
      assert.ok(fixture.container.querySelector("iframe"));
      await fixture.hidden(true);
      assert.ok(!fixture.container.querySelector("iframe"));
    } finally { await fixture.close(); }
  }
});

async function preparePhoto(image) {
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 800 });
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: 400 });
  image.parentElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 });
  await React.act(async () => image.dispatchEvent(new window.Event("load")));
  return image.parentElement;
}

async function moveMouse(target, x, y) {
  await React.act(async () => target.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y })));
}

test("desktop photo zoom follows hover within the image and resets on leave or selection without a lightbox", async () => {
  const fixture = await mountGallery({ images: ["/front.jpg", "/inside.jpg"] });
  try {
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const photo = track.querySelector('img[src="/front.jpg"]');
    const frame = await preparePhoto(photo);
    const zoom = () => frame.querySelector('img[aria-hidden="true"]');
    await React.act(async () => photo.click());
    assert.ok(!document.querySelector("dialog"));
    assert.ok(!track.querySelector('[aria-haspopup="dialog"]'));
    await moveMouse(frame, 200, 30);
    assert.ok(!zoom(), "Letterboxed space must not zoom");
    await moveMouse(frame, 200, 200);
    assert.equal(zoom().style.transform, "scale(2)");
    assert.equal(zoom().style.transformOrigin, "50% 50%");
    await moveMouse(frame, 300, 200);
    assert.equal(zoom().style.transformOrigin, "75% 50%");
    await React.act(async () => frame.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })));
    assert.ok(!zoom(), "Leaving the photo resets zoom");
    await moveMouse(frame, 200, 200);
    assert.ok(zoom());
    await React.act(async () => fixture.container.querySelector('[aria-label="Show photo 2 of Card"]').click());
    assert.ok(!zoom(), "Switching photos clears the previous zoom");
    await moveMouse(frame, 200, 200);
    assert.ok(!zoom(), "An unselected photo cannot zoom");
  } finally { await fixture.close(); }
});

test("mobile photos preserve the swipe sequence without hover zoom or a lightbox", async () => {
  const fixture = await mountGallery({ images: ["/front.jpg", "/inside.jpg"] }, true);
  try {
    const track = fixture.container.querySelector('[aria-label="Product media"]');
    const photo = track.querySelector("img");
    const frame = await preparePhoto(photo);
    await moveMouse(frame, 200, 200);
    await React.act(async () => photo.click());
    assert.ok(!track.querySelector('img[aria-hidden="true"]'));
    assert.ok(!document.querySelector("dialog"));
    assert.equal(track.children.length, 2);
  } finally { await fixture.close(); }
});

async function mountThumbnail(props = {}) {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  let plays = 0;
  let paused = true;
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", { configurable: true, get() { return paused; } });
  window.HTMLMediaElement.prototype.play = function () { plays++; paused = false; this.dispatchEvent(new window.Event("play")); return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () { paused = true; };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let current = { kind: "native", src: "/files/demo.mp4", fallbackSrc: "/front.jpg", ...props };
  const render = async (changes = {}) => {
    current = { ...current, ...changes };
    await React.act(async () => root.render(React.createElement(Thumbnail, current)));
  };
  await render();
  return {
    container, render,
    plays: () => plays,
    emit: async (video, name) => React.act(async () => video.dispatchEvent(new window.Event(name))),
    close: async () => { await React.act(async () => root.unmount()); container.remove(); },
  };
}

function setMediaProperties(video, properties) {
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(video, name, { configurable: true, value });
  }
}

test("native thumbnail waits for a decoded representative frame and preserves its fallback on failure", async () => {
  const fixture = await mountThumbnail();
  try {
    const preview = fixture.container.querySelector("video");
    assert.ok(preview);
    assert.equal(preview.controls, false);
    assert.equal(preview.autoplay, false);
    assert.equal(preview.preload, "auto");
    assert.equal(preview.getAttribute("poster"), "/front.jpg");
    assert.ok(fixture.container.querySelector('img[src="/front.jpg"]'));
    assert.ok(preview.classList.contains("opacity-0"));

    setMediaProperties(preview, { readyState: 2, videoWidth: 640, videoHeight: 360 });
    await fixture.emit(preview, "loadeddata");
    assert.ok(preview.classList.contains("opacity-0"), "An initial data event must not replace the fallback before the preview seek");

    setMediaProperties(preview, { readyState: 1, duration: 30 });
    await fixture.emit(preview, "loadedmetadata");
    assert.equal(preview.currentTime, 1, "Skip the potentially blank opening frame");
    setMediaProperties(preview, { readyState: 2 });
    preview.currentTime = 0;
    await fixture.emit(preview, "loadeddata");
    assert.ok(preview.classList.contains("opacity-0"), "Data from the opening frame must not be shown");

    preview.currentTime = 1;
    setMediaProperties(preview, { seeking: true });
    await fixture.emit(preview, "seeked");
    assert.ok(preview.classList.contains("opacity-0"), "An unfinished seek must keep the fallback visible");
    setMediaProperties(preview, { seeking: false, videoWidth: 0, videoHeight: 0 });
    await fixture.emit(preview, "seeked");
    assert.ok(preview.classList.contains("opacity-0"), "A video without decoded dimensions is not a usable thumbnail");
    setMediaProperties(preview, { readyState: 1, videoWidth: 640, videoHeight: 360 });
    await fixture.emit(preview, "canplay");
    assert.ok(preview.classList.contains("opacity-0"), "Metadata alone must not expose an empty video surface");

    setMediaProperties(preview, { readyState: 2 });
    await fixture.emit(preview, "seeked");
    assert.ok(preview.classList.contains("opacity-100"));
    assert.equal(fixture.plays(), 0);
    await React.act(async () => preview.play());
    assert.equal(preview.paused, true);
    assert.ok(!fixture.container.querySelector("button, input, svg"));
    await fixture.emit(preview, "error");
    assert.ok(!fixture.container.querySelector("video"));
    assert.ok(fixture.container.querySelector('img[src="/front.jpg"]'), "A failed preview must leave a visible product-photo fallback");
  } finally { await fixture.close(); }
});

test("thumbnail preview supports short clips and resets readiness when its source changes", async () => {
  const fixture = await mountThumbnail();
  try {
    const preview = fixture.container.querySelector("video");
    setMediaProperties(preview, { duration: 0.2, readyState: 2, videoWidth: 640, videoHeight: 360 });
    await fixture.emit(preview, "loadedmetadata");
    assert.equal(preview.currentTime, 0.1, "A short clip seeks within its own duration");
    await fixture.emit(preview, "seeked");
    assert.ok(preview.classList.contains("opacity-100"));

    await fixture.render({ src: "/files/replacement.mp4" });
    const replacement = fixture.container.querySelector("video");
    assert.notEqual(replacement, preview);
    assert.ok(!preview.isConnected);
    assert.ok(replacement.classList.contains("opacity-0"), "A new source must not inherit a ready preview");
    setMediaProperties(replacement, { readyState: 2, videoWidth: 640, videoHeight: 360 });
    await fixture.emit(replacement, "loadeddata");
    assert.ok(replacement.classList.contains("opacity-0"));
    assert.equal(fixture.plays(), 0);
  } finally { await fixture.close(); }
});
