const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

async function withEditor(run, existing) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost/admin/blogs/new",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.confirm = () => true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const calls = [];
  let responder = async (url, options) => {
    if (!options.method) return { post: existing };
    if (url.endsWith("/images"))
      return { url: "https://example.test/upload.webp" };
    const body = JSON.parse(options.body);
    return {
      post: {
        ...body,
        reading_minutes: 1,
        published_at:
          body.status === "published" ? "2026-09-22T12:00:00Z" : null,
        created_at: "2026-09-22T12:00:00Z",
        updated_at: new Date().toISOString(),
      },
    };
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      },
    ).outputText;
    vm.runInNewContext(code, {
      exports,
      console,
      window: dom.window,
      document: dom.window.document,
      URL,
      Date,
      AbortController,
      AbortSignal,
      FormData: dom.window.FormData,
      crypto: require("node:crypto").webcrypto,
      requestAnimationFrame: (callback) => setTimeout(callback, 0),
      require(name) {
        if (name.endsWith(".css")) return {};
        if (name === "@/lib/blog") return load("lib/blog.ts");
        if (name === "@/lib/admin/blog-client")
          return {
            blogRequest: async (url, options = {}) => {
              calls.push({ url, options });
              return responder(url, options);
            },
          };
        if (name === "@/lib/admin/item-photo-client")
          return { prepareProductPhoto: async (file) => file };
        if (name === "./BlogAdminShell")
          return ({ children }) => React.createElement("div", null, children);
        if (name === "@/components/blog/BlogImage")
          return ({ src, alt }) => React.createElement("img", { src, alt });
        if (name === "@/components/blog/BlogMarkdown")
          return ({ content }) =>
            React.createElement("div", { "data-preview": true }, content);
        if (name === "next/link")
          return ({ children, ...props }) =>
            React.createElement("a", props, children);
        if (name === "lucide-react")
          return new Proxy({}, { get: () => () => null });
        return require(name);
      },
    });
    return exports;
  }
  const Editor = load("components/admin/BlogEditor.tsx").default;
  const root = createRoot(document.getElementById("root"));
  async function fill(selector, value) {
    await React.act(async () => {
      const element = document.querySelector(selector);
      assert.ok(element, `Field exists: ${selector}`);
      const prototype =
        element.tagName === "TEXTAREA"
          ? dom.window.HTMLTextAreaElement.prototype
          : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(
        element,
        value,
      );
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  }
  async function click(label) {
    await React.act(async () => {
      const buttons = [...document.querySelectorAll("button")];
      const button =
        buttons.find((node) => node.textContent.trim() === label) ||
        buttons.find((node) => node.getAttribute("aria-label") === label);
      assert.ok(button, `Button exists: ${label}`);
      button.click();
    });
  }
  const submit = () =>
    React.act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
  try {
    await React.act(async () =>
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Editor, { id: existing?.id }),
        ),
      ),
    );
    await run({
      dom,
      React,
      calls,
      fill,
      click,
      submit,
      respond: (fn) => {
        responder = fn;
      },
    });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("editor saves an incomplete draft, preserves its slug and updates the same record", async () =>
  withEditor(async ({ fill, submit, calls }) => {
    await submit();
    assert.equal(calls.length, 0);
    assert.match(document.body.textContent, /Enter a title/);
    await fill('[name="title"]', "Our beautiful beginning");
    assert.equal(
      document.querySelector('[name="slug"]').value,
      "our-beautiful-beginning",
    );
    assert.equal(document.querySelector('[name="author"]').value, "");
    await submit();
    assert.equal(calls.length, 0);
    assert.match(document.body.textContent, /Enter an author name/);
    assert.equal(document.activeElement.name, "author");
    await fill('[name="author"]', "Ananya Sharma");
    await submit();
    assert.equal(calls.length, 1);
    const create = JSON.parse(calls[0].options.body);
    assert.equal(create.status, "draft");
    assert.equal(create.content, "");
    assert.equal(create.author, "Ananya Sharma");
    assert.equal(window.location.pathname, `/admin/blogs/${create.id}`);
    await fill('[name="title"]', "Our updated beginning");
    await fill('[name="author"]', "Riya Sen");
    assert.equal(
      document.querySelector('[name="slug"]').value,
      "our-beautiful-beginning",
    );
    await submit();
    assert.equal(calls[1].options.method, "PATCH");
    assert.equal(JSON.parse(calls[1].options.body).id, create.id);
    assert.ok(JSON.parse(calls[1].options.body).expectedUpdatedAt);
    assert.equal(JSON.parse(calls[1].options.body).author, "Riya Sen");
  }));

test("publish validation, formatting and preview work before publication", async () =>
  withEditor(async ({ fill, click, calls, React, dom }) => {
    await fill('[name="title"]', "A meaningful invitation");
    await fill('[name="author"]', "Ananya Sharma");
    await click("Publish article");
    await click("Publish now");
    assert.equal(calls.length, 0);
    assert.match(document.body.textContent, /short introduction/);
    await fill('[name="excerpt"]', "A guide to thoughtful details.");
    await fill('[name="content"]', "Personal details matter.");
    await React.act(async () => {
      const editor = document.querySelector('[name="content"]');
      editor.focus();
      editor.setSelectionRange(0, 8);
      editor.dispatchEvent(new dom.window.Event("select", { bubbles: true }));
      document.dispatchEvent(
        new dom.window.Event("selectionchange", { bubbles: true }),
      );
    });
    await click("Bold");
    assert.match(document.querySelector('[name="content"]').value, /\*\*/);
    await click("Preview");
    assert.match(document.querySelector("[data-preview]").textContent, /\*\*/);
    assert.match(document.body.textContent, /By Ananya Sharma/);
    await click("Publish article");
    await click("Publish now");
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].options.body).status, "published");
    assert.match(document.body.textContent, /published and live/);
  }));

test("failed saves preserve text and retry with the same creation ID", async () =>
  withEditor(async ({ fill, submit, respond, calls }) => {
    await fill('[name="title"]', "Keep this story");
    await fill('[name="author"]', "Ananya Sharma");
    await fill('[name="content"]', "Do not lose these details.");
    respond(async () => {
      throw new Error("Service unavailable. Please retry.");
    });
    await submit();
    await submit();
    assert.equal(calls.length, 2);
    assert.equal(
      JSON.parse(calls[0].options.body).id,
      JSON.parse(calls[1].options.body).id,
    );
    assert.equal(
      document.querySelector('[name="content"]').value,
      "Do not lose these details.",
    );
    assert.match(document.body.textContent, /Service unavailable/);
  }));

test("cover uploads require alt text and inline linked images insert valid Markdown", async () =>
  withEditor(async ({ fill, click, submit, calls, React, dom }) => {
    await fill('[name="title"]', "Photo story");
    await fill('[name="author"]', "Ananya Sharma");
    await React.act(async () => {
      const input = document.querySelector('[type="file"]');
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [
          new dom.window.File(["fixture"], "cover.png", { type: "image/png" }),
        ],
      });
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(calls[0].url, "/api/admin/blogs/images");
    await submit();
    assert.equal(calls.length, 1);
    assert.match(document.body.textContent, /image description/);
    await fill('[name="cover_alt"]', "Gold details on a burgundy invitation");
    await click("Insert image");
    const panel = [...document.querySelectorAll("div")].find((node) =>
      node.firstElementChild?.textContent.includes(
        "Add an image to your story",
      ),
    );
    const labels = [...panel.querySelectorAll("label")];
    const urlInput = labels
      .find((label) => label.textContent.includes("Or paste"))
      .querySelector("input");
    const altInput = labels
      .find((label) => label.textContent.includes("Image description"))
      .querySelector("input");
    urlInput.id = "inline-url";
    altInput.id = "inline-alt";
    await fill("#inline-url", "https://example.test/card(1).jpg");
    await fill("#inline-alt", "An [invitation]");
    await click("Insert image");
    assert.match(
      document.querySelector('[name="content"]').value,
      /!\[An \\\[invitation\\\]\]\(https:\/\/example.test\/card%281%29.jpg\)/,
    );
    await submit();
    assert.equal(calls.length, 2);
    assert.equal(
      JSON.parse(calls[1].options.body).cover_alt,
      "Gold details on a burgundy invitation",
    );
  }));
