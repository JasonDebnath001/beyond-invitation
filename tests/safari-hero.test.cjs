const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

function load(file, overrides = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => name in overrides ? overrides[name] : require(name),
  });
  return exports;
}

const { subscribeMediaQuery } = load("lib/media-query.ts");

for (const legacy of [false, true]) {
  test(`viewport listeners update and detach with ${legacy ? "older Safari" : "modern browser"} APIs`, () => {
    let callback;
    const query = legacy ? {
      addListener(listener) { callback = listener; },
      removeListener(listener) { assert.equal(listener, callback); callback = undefined; },
    } : {
      addEventListener(type, listener) { assert.equal(type, "change"); callback = listener; },
      removeEventListener(type, listener) {
        assert.equal(type, "change");
        assert.equal(listener, callback);
        callback = undefined;
      },
      addListener() { assert.fail("Modern browsers should use change events"); },
    };
    const changes = [];
    const unsubscribe = subscribeMediaQuery(query, (event) => changes.push(event.matches));
    callback({ matches: true });
    callback({ matches: false });
    assert.deepEqual(changes, [true, false]);
    unsubscribe();
    assert.equal(callback, undefined);
  });
}

test("hero cards stay visible while image decoding never completes", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globals = ["window", "document", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(global, name)]));
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.matchMedia = (media) => ({
    media, matches: true, addListener() {}, removeListener() {},
  });
  let decodeCalls = 0;
  dom.window.HTMLImageElement.prototype.decode = () => {
    decodeCalls++;
    return new Promise(() => {});
  };
  const gsap = require("gsap").gsap;
  const Hero = load("components/HeroCarousel.tsx", {
    "next/font/google": { Alice: () => ({ style: { fontFamily: "serif" } }) },
    "next/image": ({ priority, quality, ...props }) => React.createElement("img", props),
    "./HeroCarousel.module.css": {},
  }).default;
  const root = require("react-dom/client").createRoot(document.getElementById("root"));
  try {
    await React.act(async () => root.render(React.createElement(Hero)));
    const cards = [...document.querySelectorAll("[data-hero-card]")];
    assert.equal(cards.length, 5);
    assert.equal(decodeCalls, 0, "The hero must not wait for a decode API or another image");
    for (const card of cards) {
      assert.notEqual(getComputedStyle(card).visibility, "hidden");
      assert.notEqual(getComputedStyle(card).opacity, "0");
    }
    await React.act(async () => root.unmount());
    for (const card of cards) assert.equal(card.style.transform, "", "Unmount restores animation styles");
  } finally {
    gsap.ticker.sleep();
    dom.window.close();
    for (const name of globals) {
      const descriptor = previous.get(name);
      if (descriptor) Object.defineProperty(global, name, descriptor);
      else delete global[name];
    }
  }
});
