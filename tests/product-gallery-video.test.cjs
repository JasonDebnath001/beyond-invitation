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

const Video = loadComponent("components/ProductGalleryVideo.tsx");
const Gallery = loadComponent("components/ProductGallery.tsx", {
  "@/components/ProductGalleryVideo": { __esModule: true, default: Video },
  "@/components/ProductImage": { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) },
});

after(() => dom.window.close());

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
  assert.equal(gallery.querySelectorAll("video").length, 2);
  assert.ok(!gallery.querySelector('img[src*="hidden.jpg"]'));
  const videoOnly = render({ images: [], videos: ["/files/demo.webm"] });
  assert.equal(videoOnly.querySelector('[aria-label="Product media"]').children.length, 1);
  assert.ok(videoOnly.querySelector("video"));
});

async function mountVideo(props = {}, mobile = true) {
  let hidden = false;
  let observer;
  const listeners = new Set();
  const query = {
    matches: mobile,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  window.matchMedia = () => query;
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
  let current = { src: "/files/demo.mp4", kind: "native", label: "Card video", paused: false, onError() {}, ...props };
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
    mobile: async (value) => React.act(async () => { query.matches = value; listeners.forEach((listener) => listener()); }),
    close: async () => { await React.act(async () => root.unmount()); assert.ok(observer.disconnected); container.remove(); },
  };
}

test("mobile video plays only in the visible slide and pauses offscreen, behind a dialog, or in a hidden tab", async () => {
  const fixture = await mountVideo();
  try {
    assert.equal(fixture.plays(), 0);
    await fixture.visible(100, 600);
    assert.equal(fixture.plays(), 0, "The edge of an adjacent slide must not autoplay");
    await fixture.visible(400, 500);
    assert.equal(fixture.plays(), 1, "A tall portrait video can play without its entire height being visible");
    const video = fixture.container.querySelector("video");
    assert.ok(video.muted);
    assert.ok(video.playsInline);
    assert.equal(video.controls, false, "Native controls stay hidden");
    assert.equal(fixture.container.querySelectorAll("button").length, 1);
    assert.ok(fixture.container.querySelector('button[aria-label="Pause Card video"]'));
    assert.ok(!fixture.container.querySelector("input"));
    assert.ok(!fixture.container.querySelector('[aria-label="Video controls"]'));
    let pauses = fixture.pauses();
    await fixture.visible(0, 0);
    assert.ok(fixture.pauses() > pauses);
    await fixture.visible(400, 500);
    pauses = fixture.pauses();
    await fixture.hidden(true);
    assert.ok(fixture.pauses() > pauses);
    await fixture.hidden(false);
    pauses = fixture.pauses();
    await fixture.render({ paused: true });
    assert.ok(fixture.pauses() > pauses);
    const plays = fixture.plays();
    await fixture.visible(400, 500);
    assert.equal(fixture.plays(), plays, "A lightbox suspends inline playback");
  } finally { await fixture.close(); }
});

test("desktop shows only a play overlay and plays or pauses inline from its opening frame", async () => {
  const fixture = await mountVideo({}, false);
  try {
    const video = fixture.container.querySelector("video");
    Object.defineProperty(video, "readyState", { value: 2 });
    Object.defineProperty(video, "duration", { value: 30 });
    await React.act(async () => video.dispatchEvent(new window.Event("loadedmetadata")));
    assert.ok(video.currentTime > 0 && video.currentTime < 0.01);
    await fixture.visible(400, 500);
    assert.equal(fixture.plays(), 0);
    assert.equal(video.controls, false);
    assert.equal(video.getAttribute("aria-label"), "Card video");
    assert.equal(video.getAttribute("role"), null);
    assert.ok(!fixture.container.querySelector('[aria-haspopup="dialog"]'));
    assert.equal(fixture.container.querySelectorAll("button").length, 1);
    assert.ok(!fixture.container.querySelector("input"));
    assert.ok(!fixture.container.querySelector('[aria-label="Video controls"]'));
    const playButton = fixture.container.querySelector('button[aria-label="Play Card video"]');
    assert.ok(playButton, "A native button provides keyboard and pointer playback activation");
    assert.ok(playButton.querySelector("svg"), "Paused preview shows the play icon");
    await React.act(async () => playButton.click());
    assert.ok(fixture.plays() > 0);
    assert.equal(video.paused, false);
    assert.ok(!document.querySelector("dialog"));
    const pauseButton = fixture.container.querySelector('button[aria-label="Pause Card video"]');
    assert.ok(pauseButton);
    assert.ok(!pauseButton.querySelector("svg"), "Playing video has no visible control icon");
    await React.act(async () => pauseButton.click());
    assert.equal(video.paused, true);
    const plays = fixture.plays();
    await fixture.visible(0, 0);
    await fixture.visible(400, 500);
    await fixture.render();
    assert.equal(fixture.plays(), plays, "Explicit pause survives visibility and rerender changes");
    await React.act(async () => fixture.container.querySelector('button[aria-label="Play Card video"]').click());
    assert.equal(video.paused, false);
  } finally { await fixture.close(); }
});

test("embedded videos override inherited autoplay and unload playback when the slide leaves view", async () => {
  const fixture = await mountVideo({ kind: "embed", src: "https://player.vimeo.com/video/123?autoplay=1&background=1" });
  try {
    const url = () => new URL(fixture.container.querySelector("iframe").src);
    assert.equal(url().searchParams.get("autoplay"), "0");
    assert.equal(url().searchParams.get("background"), "0");
    assert.equal(url().searchParams.get("controls"), "0");
    await fixture.visible(400, 500);
    const playingFrame = fixture.container.querySelector("iframe");
    assert.equal(url().searchParams.get("autoplay"), "1");
    assert.equal(url().searchParams.get("muted"), "1");
    await fixture.visible(0, 0);
    assert.equal(url().searchParams.get("autoplay"), "0");
    assert.ok(!playingFrame.isConnected);
  } finally { await fixture.close(); }
});

test("desktop embedded video uses the sole play overlay for inline playback with provider controls hidden", async () => {
  const fixture = await mountVideo({ kind: "embed", src: "https://www.youtube.com/embed/test-video?autoplay=1&controls=1" }, false);
  try {
    const url = () => new URL(fixture.container.querySelector("iframe").src);
    await fixture.visible(400, 500);
    assert.equal(url().searchParams.get("autoplay"), "0");
    assert.equal(url().searchParams.get("controls"), "0");
    assert.equal(fixture.container.querySelectorAll("button").length, 1);
    assert.ok(!fixture.container.querySelector("input"));
    await React.act(async () => fixture.container.querySelector('button[aria-label="Play Card video"]').click());
    assert.equal(url().searchParams.get("autoplay"), "1");
    assert.ok(!document.querySelector("dialog"));
    await React.act(async () => fixture.container.querySelector('button[aria-label="Pause Card video"]').click());
    assert.equal(url().searchParams.get("autoplay"), "0");
    await fixture.visible(0, 0);
    await fixture.visible(400, 500);
    assert.equal(url().searchParams.get("autoplay"), "0", "Explicit pause remains after returning to the slide");
    await React.act(async () => fixture.container.querySelector('button[aria-label="Play Card video"]').click());
    assert.equal(url().searchParams.get("autoplay"), "1");
    await fixture.hidden(true);
    assert.equal(url().searchParams.get("autoplay"), "0");
  } finally { await fixture.close(); }
});
