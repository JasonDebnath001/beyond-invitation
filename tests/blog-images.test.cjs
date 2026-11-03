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
after(() => dom.window.close());

function loadModule(file, additionalImports = {}) {
  const imports = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "lucide-react": require("lucide-react"),
    ...additionalImports,
  };
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected test import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}
const blog = loadModule("lib/blog.ts");
const css = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };

async function mountPicker({ prepare, upload, acceptInsert = true } = {}) {
  const calls = [];
  const inserted = [];
  const busy = [];
  const pending = [];
  let closed = 0;
  const Picker = loadModule("components/admin/BlogImagePicker.tsx", {
    "@/lib/blog": blog,
    "@/lib/admin/item-photo-client": {
      prepareProductPhoto: async (file, signal) => {
        calls.push(`prepare:${file.name}`);
        return prepare ? prepare(file, signal) : file;
      },
    },
    "@/lib/admin/blog-client": {
      blogRequest: async (url, options) => {
        assert.equal(url, "/api/admin/blogs/images");
        assert.equal(options.method, "POST");
        const file = options.body.get("image");
        calls.push(`upload:${file.name}`);
        return upload ? upload(file, options.signal) : { url: `https://images.example/${file.name}` };
      },
    },
    "@/components/blog/BlogImage": { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) },
    "./BlogAdmin.module.css": css,
  }).default;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Picker, {
    disabled: false,
    onBusyChange: (value) => { busy.push(value); },
    onPendingChange: (value) => { pending.push(value); },
    onInsert: (value) => { inserted.push(value); return acceptInsert; },
    onClose: () => { closed++; },
  })));
  return {
    container, calls, inserted, busy, pending,
    get closed() { return closed; },
    async select(names) {
      const input = container.querySelector('input[type="file"]');
      assert.equal(input.multiple, true);
      Object.defineProperty(input, "files", { configurable: true, value: names.map((name) => new File(["photo"], name, { type: "image/png" })) });
      await React.act(async () => input.dispatchEvent(new window.Event("change", { bubbles: true })));
    },
    async fill(input, value) {
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    },
    async click(text) {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent.trim() === text || item.getAttribute("aria-label") === text);
      assert.ok(button, `Missing button: ${text}`);
      await React.act(async () => button.click());
    },
    async describe(values) {
      const inputs = container.querySelectorAll('ol input');
      assert.equal(inputs.length, values.length);
      for (const [index, value] of values.entries()) await this.fill(inputs[index], value);
    },
    async close() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("multiple selected images upload in order and render together with exact descriptions", async () => {
  const fixture = await mountPicker();
  try {
    await fixture.select(["front.png", "inside(2).png"]);
    assert.deepEqual(fixture.calls, ["prepare:front.png", "upload:front.png", "prepare:inside(2).png", "upload:inside(2).png"]);
    assert.deepEqual([...fixture.container.querySelectorAll("img")].map((image) => image.src), ["https://images.example/front.png", "https://images.example/inside(2).png"]);
    assert.deepEqual(fixture.busy, [true, false]);
    assert.equal(fixture.pending.at(-1), true);
    const descriptions = ["Gold [front] with *flowers*", "Inside <details> and `script` \\ paper"];
    await fixture.describe(descriptions);
    await fixture.click("Insert 2 images");
    assert.equal(fixture.inserted.length, 1);
    assert.equal(fixture.container.querySelectorAll("ol li").length, 0);
    assert.equal(fixture.pending.at(-1), false);
    assert.equal(fixture.closed, 1);

    const [markdown, gfm] = await Promise.all([import("react-markdown"), import("remark-gfm")]);
    const BlogMarkdown = loadModule("components/blog/BlogMarkdown.tsx", {
      "react-markdown": { __esModule: true, ...markdown },
      "remark-gfm": { __esModule: true, ...gfm },
      "@/lib/blog": blog,
      "./Blog.module.css": css,
    }).default;
    const article = document.createElement("div");
    article.innerHTML = renderToStaticMarkup(React.createElement(BlogMarkdown, { content: fixture.inserted[0] }));
    assert.deepEqual([...article.querySelectorAll("img")].map((image) => image.alt), descriptions);
    assert.deepEqual([...article.querySelectorAll("img")].map((image) => image.src), ["https://images.example/front.png", "https://images.example/inside(2).png"]);
    assert.equal(article.querySelectorAll("script, details").length, 0);

    await fixture.select(["envelope.png"]);
    await fixture.describe(["The envelope"]);
    await fixture.click("Insert 1 image");
    assert.equal(fixture.inserted.length, 2);
    assert.ok(!fixture.inserted[1].includes("front.png"), "Inserting another batch must not duplicate earlier images");
  } finally { await fixture.close(); }
});

test("one failed upload preserves the other images and retries only the failed file", async () => {
  let fail = true;
  const fixture = await mountPicker({ upload: (file) => {
    if (file.name === "inside.png" && fail) throw new Error("Temporary upload failure");
    return { url: `https://images.example/${file.name}` };
  } });
  try {
    await fixture.select(["front.png", "inside.png", "envelope.png"]);
    assert.equal(fixture.container.querySelectorAll("ol li").length, 3);
    assert.equal(fixture.container.querySelectorAll("img").length, 2);
    assert.match(fixture.container.textContent, /Temporary upload failure/);
    await fixture.describe(["Front", "Inside", "Envelope"]);
    await fixture.click("Insert 3 images");
    assert.equal(fixture.inserted.length, 0);
    fail = false;
    await fixture.click("Retry failed uploads");
    assert.deepEqual(fixture.calls.slice(6), ["prepare:inside.png", "upload:inside.png"]);
    assert.deepEqual([...fixture.container.querySelectorAll("img")].map((image) => image.src), ["https://images.example/front.png", "https://images.example/inside.png", "https://images.example/envelope.png"]);
    await fixture.click("Insert 3 images");
    assert.equal(fixture.inserted.length, 1);
    assert.deepEqual(fixture.busy, [true, false, true, false]);
  } finally { await fixture.close(); }
});

test("linked images require safe URLs and descriptions and retain an unadded URL", async () => {
  const fixture = await mountPicker();
  try {
    const url = fixture.container.querySelector('input[placeholder="https://..."]');
    await fixture.fill(url, "javascript:alert(1)");
    await fixture.click("Add URL");
    assert.equal(fixture.container.querySelectorAll("ol li").length, 0);
    assert.match(fixture.container.textContent, /Use an HTTPS image URL/);
    await fixture.fill(url, "/photos/front.png");
    await fixture.click("Add URL");
    await fixture.click("Insert 1 image");
    assert.equal(fixture.inserted.length, 0);
    assert.match(fixture.container.textContent, /short description/);
    await fixture.describe(["Front of the invitation"]);
    await fixture.fill(url, "https://images.example/inside.png");
    await fixture.click("Insert 1 image");
    assert.equal(fixture.inserted.length, 0);
    assert.match(fixture.container.textContent, /Add the image URL to the selection or clear it/);
    await fixture.click("Add URL");
    await fixture.describe(["Front of the invitation", "Inside of the invitation"]);
    await fixture.click("Insert 2 images");
    assert.equal(fixture.inserted.length, 1);
    assert.equal(fixture.calls.length, 0, "Linked images do not need a file upload");
  } finally { await fixture.close(); }
});

test("a rejected insertion keeps the image selection until the editor accepts it or the user removes it", async () => {
  const fixture = await mountPicker({ acceptInsert: false });
  try {
    await fixture.select(["front.png", "inside.png"]);
    await fixture.describe(["Front", "Inside"]);
    await fixture.click("Insert 2 images");
    assert.equal(fixture.closed, 0);
    assert.equal(fixture.container.querySelectorAll("img").length, 2);
    assert.equal(fixture.pending.at(-1), true);
    await fixture.click("Remove image 1");
    assert.equal(fixture.container.querySelector("img").alt, "Inside");
    await fixture.click("Remove image 1");
    assert.equal(fixture.pending.at(-1), false);
  } finally { await fixture.close(); }
});

test("uploads lock image actions and abort when the editor unmounts", async () => {
  let finish;
  let signal;
  const fixture = await mountPicker({ prepare: (file, currentSignal) => {
    signal = currentSignal;
    return new Promise((resolve) => { finish = () => resolve(file); });
  } });
  await fixture.select(["front.png", "inside.png"]);
  assert.equal(fixture.container.querySelector('input[type="file"]').disabled, true);
  assert.equal(fixture.container.querySelector('button[aria-label="Remove image 1"]').disabled, true);
  assert.match(fixture.container.querySelector('[role="status"]').textContent, /Uploading image 1 of 2/);
  await fixture.close();
  assert.equal(signal.aborted, true);
  await React.act(async () => finish());
  assert.deepEqual(fixture.calls, ["prepare:front.png"], "Aborted preparation must not upload or start the next file");
});
