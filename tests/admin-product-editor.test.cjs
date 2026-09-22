const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

async function withDialog(run, item, dashboard = false, options = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/admin" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    // Native dialog queues close events, including during StrictMode effect cleanup.
    Promise.resolve().then(() => this.dispatchEvent(new dom.window.Event("close")));
  };
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const calls = [], created = [];
  let closed = 0;
  const timers = new Map();
  let timerId = 0;
  let read = options.read;
  let respond = async () => ({ ok: true, json: async () => ({ id: "new", designNo: "NEW-01" }) });
  const prepared = [];
  let prepare = options.prepare ?? (async file => file);
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports, console, AbortController, Error,
      setTimeout: options.fakeTimers ? (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; } : setTimeout,
      clearTimeout: options.fakeTimers ? id => timers.delete(id) : clearTimeout,
      FormData: dom.window.FormData, crypto: require("node:crypto").webcrypto, URL: { createObjectURL: () => "blob:test-photo", revokeObjectURL() {} },
      fetch: async (url, init) => {
        if (!init.method) {
          const call = { url, method: "GET", signal: init.signal };
          calls.push(call);
          if (read) return read(call);
          const body = url.includes("view=editor") ? data : {
            companies: data.companies, companyId: data.companyId,
            items: data.items.map(item => ({
              id: item.id, designNo: item.designNo, code: item.code, printName: item.printName,
              category: item.category, subject: item.subject, active: item.active, visible: item.visible,
              imageUrl: item.values.image_url, hasDescription: !!item.description, updatedAt: item.updatedAt,
            })),
          };
          return { ok: true, json: async () => JSON.parse(JSON.stringify(body)) };
        }
        const multipart = init.body instanceof dom.window.FormData;
        const call = { url, method: init.method, body: multipart ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body), photo: multipart ? init.body.get("photo") : undefined };
        calls.push(call); return respond(call);
      },
      require(name) {
        if (name === "./ItemDashboard.module.css") return {};
        if (name === "@/lib/admin/item-fields") return load("lib/admin/item-fields.ts");
        if (name === "@/lib/admin/item-client") return load("lib/admin/item-client.ts");
        if (name === "@/lib/admin/item-photo-client") return { prepareProductPhoto(file, signal) { prepared.push({ file, signal }); return prepare(file, signal); } };
        if (name === "./ProductPhoto") return load("components/admin/ProductPhoto.tsx");
        if (name === "./ProductEditorDialog") return load("components/admin/ProductEditorDialog.tsx");
        if (name === "next/image") return ({ unoptimized, priority, ...props }) => React.createElement("img", props);
        if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
        return require(name);
      },
    });
    return exports;
  }
  const Dialog = load(dashboard ? "components/admin/ItemDashboard.tsx" : "components/admin/ProductEditorDialog.tsx").default;
  const root = createRoot(document.getElementById("root"));
  const data = { companyId: "company", companies: [{ id: "company", name: "Test company" }], items: dashboard ? [item] : [], itemTypes: ["Finished"], referenceOptions: { item_groups: [{ id: "group", name: "Cards", shared: false }], item_categories: [{ id: "category", name: "Wedding Card", shared: true }] } };
  const fill = (name, value) => { document.querySelector(`[name="${name}"]`).value = value; };
  const submit = () => React.act(async () => { document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  const valid = () => { fill("name", "NEW-01"); fill("group_id", "group"); fill("item_type", "Finished"); };
  const choosePhoto = (file) => React.act(async () => {
    const input = document.querySelector('[type="file"]');
    Object.defineProperty(input, "files", { configurable: true, value: Array.isArray(file) ? file : [file] });
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  try {
    await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Dialog, { data, item, onClose() { closed++; }, onSaved(product) { created.push(product); } }))));
    await run({ calls, created, data, fill, valid, submit, choosePhoto, React, dom, timers, prepared, prepare: fn => { prepare = fn; }, read: fn => { read = fn; }, closed: () => closed, respond: fn => { respond = fn; } });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("add product stays open in StrictMode, requires core fields and sends defaults with the selected company", async () => withDialog(async ({ calls, created, valid, fill, submit, closed }) => {
  assert.equal(document.querySelector("dialog").open, true);
  assert.equal(closed(), 0);
  await submit();
  assert.equal(calls.length, 0);
  valid();
  fill("min_order_qty", "0");
  await submit();
  assert.equal(calls.length, 0);
  fill("min_order_qty", "50");
  fill("item_category_id", "category");
  fill("print_name", "Gold invitation");
  fill("image_url", "https://example.test/image.jpg");
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/admin/items");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body.companyId, "company");
  assert.equal(calls[0].body.values.name, "NEW-01");
  assert.equal(calls[0].body.values.min_order_qty, "50");
  assert.equal(calls[0].body.values.show_on_website, "N");
  assert.equal(calls[0].body.values.is_active, "N");
  assert.equal(calls[0].body.values.item_category_id, "category");
  assert.equal(calls[0].body.values.id, undefined);
  assert.equal(created.length, 1);
}));

test("failed saves preserve inputs, focus the error, unlock the form and allow retry", async () => withDialog(async ({ respond, calls, created, valid, fill, submit }) => {
  valid(); fill("print_name", "Keep this title");
  respond(async () => ({ ok: false, json: async () => ({ error: "Check the product details below.", issues: ["Item Type: invalid value."] }) }));
  await submit();
  assert.equal(created.length, 0);
  assert.equal(document.querySelector('[name="print_name"]').value, "Keep this title");
  assert.equal(document.activeElement.getAttribute("role"), "alert");
  assert.match(document.activeElement.textContent, /Item Type: invalid value/);
  assert.equal(document.querySelector("fieldset").disabled, false);
  respond(async () => ({ ok: true, json: async () => ({ id: "new", designNo: "NEW-01" }) }));
  await submit();
  assert.equal(calls.length, 2);
  assert.equal(created.length, 1);
}));

test("pending saves prevent duplicate submissions, cancellation and edits", async () => withDialog(async ({ respond, calls, created, valid, submit, React, dom }) => {
  let finish;
  respond(() => new Promise(resolve => { finish = resolve; }));
  valid();
  await submit();
  assert.equal(document.querySelector("fieldset").disabled, true);
  assert.equal(document.querySelector('[type="submit"]').disabled, true);
  const cancel = new dom.window.Event("cancel", { cancelable: true });
  document.querySelector("dialog").dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  await submit();
  assert.equal(calls.length, 1);
  await React.act(async () => finish({ ok: true, json: async () => ({ id: "new", designNo: "NEW-01" }) }));
  assert.equal(created.length, 1);
}));

test("invalid advanced fields expand their section; cancelling never submits", async () => withDialog(async ({ valid, fill, submit, calls, React, closed }) => {
  valid(); fill("offer_pct", "101");
  const advanced = document.querySelector('[name="offer_pct"]').closest("details");
  assert.equal(advanced.open, false);
  await submit();
  assert.equal(advanced.open, true);
  assert.equal(calls.length, 0);
  await React.act(async () => document.querySelector('[aria-label="Close add product"]').click());
  assert.equal(closed(), 1);
  assert.equal(document.querySelector("dialog").open, false);
}));

const existingItem = {
  id: "11111111-1111-4111-a111-111111111111", designNo: "AC-507", updatedAt: "2026-09-19T00:00:00Z",
  fields: { Brand: "Previous brand" },
  values: { name: "AC-507", code: "IT1", print_name: "Current title", group_id: "", item_type: "", brand_id: "inactive-brand", image_url: "https://example.test/old.jpg", is_active: "N", show_on_website: "Y", min_order_qty: "0", offer_pct: "0" },
};

test("editing prefills values and references, preserves legacy fields, and sends only the changes", async () => withDialog(async ({ fill, submit, calls }) => {
  assert.equal(document.querySelector("h2").textContent, "Edit product");
  assert.equal(document.querySelector('[name="name"]').readOnly, true);
  assert.equal(document.querySelector('[name="print_name"]').value, "Current title");
  assert.equal(document.querySelector('[name="brand_id"]').value, "inactive-brand");
  assert.equal(document.querySelector('[name="is_active"]').value, "N");
  fill("web_description", "New invitation details");
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].body.id, existingItem.id);
  assert.equal(calls[0].body.expectedUpdatedAt, existingItem.updatedAt);
  assert.deepEqual(calls[0].body.values, { web_description: "New invitation details" });
}, existingItem));

test("dashboard filters incomplete items, opens the editor and refreshes after saving", async () => withDialog(async ({ data, calls, fill, submit, respond, React, dom }) => {
  assert.ok(calls.every(call => !call.url.includes("view=editor")));
  const filter = document.querySelector('[aria-label="Filter items"]');
  await React.act(async () => { filter.value = "missing-photo"; filter.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  assert.equal(document.querySelectorAll("tbody tr").length, 1);
  await React.act(async () => document.querySelector('[aria-label="Edit AC-507"]').click());
  assert.equal(calls.filter(call => call.url.includes(`view=editor&companyId=company&itemId=${existingItem.id}`)).length, 1);
  assert.equal(document.querySelector("dialog").open, true);
  fill("image_url", "https://example.test/added-photo.webp");
  fill("web_description", "Completed description");
  respond(async () => {
    data.items[0].values.image_url = "https://example.test/added-photo.webp";
    data.items[0].description = "Completed description";
    return { ok: true, json: async () => ({ id: existingItem.id, designNo: "AC-507" }) };
  });
  await submit();
  assert.equal(document.querySelector("dialog"), null);
  assert.match(document.querySelector('[role="status"]').textContent, /Changes to AC-507 saved successfully/);
  assert.equal(calls.filter(call => call.method === "PATCH").length, 1);
  assert.ok(calls.filter(call => call.method === "GET").length >= 2);
  assert.equal(document.querySelector('[aria-label="Edit AC-507"]'), null);
  await React.act(async () => { filter.value = "all"; filter.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  assert.ok(document.querySelector('[aria-label="Edit AC-507"]'));
}, { ...existingItem, code: "IT1", printName: "Current title", category: "", subject: "", description: "", active: true, visible: true, values: { ...existingItem.values, image_url: "" } }, true));

for (const phase of ["headers", "body"]) {
  test(`dashboard stops spinning when response ${phase} stall, retries and ignores late results`, async () => {
    const lateResponses = [];
    const pending = () => new Promise(resolve => lateResponses.push(resolve));
    await withDialog(async ({ calls, React, timers, read }) => {
      assert.match(document.querySelector("tbody").textContent, /Loading your item library/);
      assert.equal(calls[0].signal.aborted, true, "StrictMode cleanup cancels the abandoned request");
      assert.equal(timers.size, 1);
      await React.act(async () => {
        for (const timer of timers.values()) { assert.equal(timer.ms, 15000); timer.fn(); }
      });
      assert.equal(timers.size, 0);
      assert.ok(calls.every(call => call.signal.aborted));
      assert.doesNotMatch(document.querySelector("tbody").textContent, /Loading your item library/);
      assert.match(document.querySelector("tbody").textContent, /Could not load the item library/);
      assert.match(document.querySelector('[role="alert"]').textContent, /took too long/);
      read(undefined);
      await React.act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Retry").click());
      assert.equal(document.querySelector('[role="alert"]'), null);
      assert.ok(document.querySelector('[aria-label="Edit AC-507"]'));
      await React.act(async () => {
        const empty = { companies: [], companyId: "company", items: [] };
        for (const resolve of lateResponses) resolve(phase === "headers" ? { ok: true, json: async () => empty } : empty);
      });
      assert.ok(document.querySelector('[aria-label="Edit AC-507"]'), "late responses cannot overwrite retried results");
      assert.equal(timers.size, 0);
    }, { ...existingItem, code: "IT1", printName: "Current title", category: "", subject: "", description: "", active: true, visible: true }, true, {
      fakeTimers: true,
      read: phase === "headers" ? pending : async () => ({ ok: true, json: pending }),
    });
  });
}

test("dashboard shows a retryable error for a non-JSON server response", async () => withDialog(async ({ React, read }) => {
  assert.match(document.querySelector('[role="alert"]').textContent, /incomplete response/);
  assert.doesNotMatch(document.querySelector("tbody").textContent, /Loading your item library/);
  read(undefined);
  await React.act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Retry").click());
  assert.ok(document.querySelector('[aria-label="Edit AC-507"]'));
}, { ...existingItem, code: "IT1", printName: "Current title", category: "", subject: "", description: "", active: true, visible: true }, true, {
  read: async () => ({ ok: false, json: async () => { throw new SyntaxError("Unexpected token '<'"); } }),
}));

test("editing sends explicit clears and validates changed numeric fields", async () => withDialog(async ({ fill, submit, calls }) => {
  fill("print_name", "");
  fill("offer_pct", "101");
  await submit();
  assert.equal(calls.length, 0);
  fill("offer_pct", "10");
  await submit();
  assert.deepEqual(calls[0].body.values, { print_name: "", offer_pct: "10" });
}, existingItem));

test("multiple photos preview alongside the existing gallery and upload separately after saving edits", async () => withDialog(async ({ choosePhoto, dom, calls, submit, fill }) => {
  assert.equal(document.querySelector('[type="file"]').multiple, true);
  await choosePhoto([new dom.window.File(["photo1"], "front.png", { type: "image/png" }), new dom.window.File(["photo2"], "back.png", { type: "image/png" })]);
  assert.equal(calls.length, 0);
  assert.equal(document.querySelectorAll('[aria-label="Selected photos"] img').length, 2);
  assert.equal(document.querySelectorAll('[aria-label="Existing product photos"] img').length, 2);
  assert.equal(document.querySelector("img").getAttribute("src"), existingItem.values.image_url);
  fill("web_description", "With foil details");
  await submit();
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body.values, { web_description: "With foil details" });
  assert.deepEqual(calls.slice(1).map(call => call.photo.name), ["front.png", "back.png"]);
  assert.ok(calls.slice(1).every(call => call.url === "/api/admin/items/photos" && call.body.companyId === "company"));
  assert.notEqual(calls[1].body.uploadId, calls[2].body.uploadId);
}, { ...existingItem, images: [existingItem.values.image_url, "https://example.test/gallery.jpg"] }));

test("unsupported and oversized photos never upload; undoing a selection restores the current photo", async () => withDialog(async ({ choosePhoto, dom, calls, React }) => {
  await choosePhoto(new dom.window.File(["svg"], "unsafe.svg", { type: "image/svg+xml" }));
  assert.match(document.querySelector('[role="alert"]').textContent, /JPG, PNG or WebP/);
  await choosePhoto(new dom.window.File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }));
  assert.match(document.querySelector('[role="alert"]').textContent, /20 MB/);
  assert.equal(calls.length, 0);
  await choosePhoto(new dom.window.File(["photo"], "new.png", { type: "image/png" }));
  await React.act(async () => document.querySelector('[aria-label="Remove new.png"]').click());
  assert.equal(document.querySelector("img").getAttribute("src"), existingItem.values.image_url);
  assert.equal(document.querySelector('[name="image_url"]').disabled, false);
  assert.equal(calls.length, 0);
}, existingItem));

test("photo selection is additive, deduplicates repeated files, and can remove one queued photo", async () => withDialog(async ({ choosePhoto, dom, React }) => {
  const one = new dom.window.File(["one"], "one.png", { type: "image/png" });
  const two = new dom.window.File(["two"], "two.png", { type: "image/png" });
  await choosePhoto([one, two]);
  await choosePhoto([one, new dom.window.File(["three"], "three.png", { type: "image/png" })]);
  assert.equal(document.querySelectorAll('[aria-label="Selected photos"] img').length, 3);
  await React.act(async () => document.querySelector('[aria-label="Remove two.png"]').click());
  assert.equal(document.querySelectorAll('[aria-label="Selected photos"] img').length, 2);
  assert.ok(document.querySelector('[aria-label="Remove one.png"]'));
}, existingItem));

test("partial upload failures keep saved photos and retry only pending files with the same upload ID", async () => withDialog(async ({ choosePhoto, dom, respond, calls, submit, created }) => {
  await choosePhoto([new dom.window.File(["one"], "one.png", { type: "image/png" }), new dom.window.File(["two"], "two.png", { type: "image/png" })]);
  respond(async call => call.photo?.name === "two.png" ? { ok: false, json: async () => ({ error: "Connection interrupted" }) } : { ok: true, json: async () => ({ id: existingItem.id, designNo: "AC-507" }) });
  await submit();
  assert.equal(created.length, 0);
  assert.match(document.querySelector('[role="alert"]').textContent, /1 of 2 selected photos are saved/);
  assert.equal(document.querySelector('[name="print_name"]').closest("fieldset").disabled, true);
  assert.equal(document.querySelector('[type="submit"]').textContent, "Retry remaining photos");
  assert.equal(document.querySelector('[aria-label="Remove one.png"]'), null);
  respond(async () => ({ ok: true, json: async () => ({ id: "saved" }) }));
  await submit();
  assert.equal(calls.filter(call => call.method === "PATCH").length, 1);
  assert.deepEqual(calls.filter(call => call.photo).map(call => call.photo.name), ["one.png", "two.png", "two.png"]);
  assert.equal(calls[2].body.uploadId, calls[3].body.uploadId);
  assert.equal(created.length, 1);
}, existingItem));

test("14 MB originals prepare sequentially, keep original names and deduplicate selections before uploading smaller files", async () => withDialog(async ({ choosePhoto, dom, calls, submit, prepare, prepared, React, respond }) => {
  const first = new dom.window.File([new Uint8Array(14 * 1024 * 1024)], "front.jpg", { type: "image/jpeg", lastModified: 100 });
  const second = new dom.window.File([new Uint8Array(14 * 1024 * 1024)], "back.png", { type: "image/png", lastModified: 200 });
  let finish;
  prepare(file => file === first ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(new dom.window.File(["small-back"], "back.webp", { type: "image/webp" })));
  await choosePhoto([first, second]);
  assert.equal(prepared.length, 1, "large images are processed one at a time");
  assert.equal(document.querySelector('[type="submit"]').disabled, true);
  assert.match(document.querySelector('[role="status"]').textContent, /Preparing photo 1 of 2/);
  await submit();
  assert.equal(calls.length, 0, "nothing saves while preparation is running");
  await React.act(async () => finish(new dom.window.File(["small-front"], "front.webp", { type: "image/webp" })));
  assert.equal(prepared.length, 2);
  assert.equal(document.querySelector('[type="submit"]').disabled, false);
  assert.ok(document.querySelector('[aria-label="Remove front.jpg"]'));
  assert.ok(document.querySelector('[aria-label="Remove back.png"]'));
  await choosePhoto([first, second]);
  assert.equal(prepared.length, 2, "deduplication uses original file identity");
  respond(async call => call.photo?.name === "back.webp" ? { ok: false, json: async () => ({ error: "Connection interrupted" }) } : { ok: true, json: async () => ({ id: existingItem.id, designNo: "AC-507" }) });
  await submit();
  const uploads = calls.filter(call => call.photo);
  assert.deepEqual(uploads.map(call => call.photo.name), ["front.webp", "back.webp"]);
  assert.ok(uploads.every(call => call.photo.size < 3 * 1024 * 1024));
  respond(async () => ({ ok: true, json: async () => ({ id: existingItem.id }) }));
  await submit();
  assert.equal(prepared.length, 2, "retry reuses the prepared file");
  assert.equal(calls.at(-1).body.uploadId, uploads[1].body.uploadId);
  assert.equal(first.size, 14 * 1024 * 1024, "originals remain unchanged");
}, existingItem));

test("a failed photo preparation preserves successful selections and can be retried", async () => withDialog(async ({ choosePhoto, dom, calls, prepare, prepared, submit }) => {
  const files = ["front.jpg", "back.jpg"].map(name => new dom.window.File(["original"], name, { type: "image/jpeg" }));
  prepare(async file => { if (file.name === "back.jpg") throw new Error("This photo could not be read."); return file; });
  await choosePhoto(files);
  assert.ok(document.querySelector('[aria-label="Remove front.jpg"]'));
  assert.equal(document.querySelector('[aria-label="Remove back.jpg"]'), null);
  assert.match(document.querySelector('[role="alert"]').textContent, /back.jpg: This photo could not be read/);
  assert.equal(document.querySelector('[type="submit"]').disabled, false);
  prepare(async file => file);
  await choosePhoto(files);
  assert.equal(prepared.length, 3);
  assert.equal(document.querySelector('[role="alert"]'), null);
  await submit();
  assert.equal(calls.filter(call => call.photo).length, 2);
}, existingItem));

test("closing during photo preparation cancels work and ignores its late result", async () => withDialog(async ({ choosePhoto, dom, prepare, prepared, React, calls, closed }) => {
  const file = new dom.window.File(["original"], "photo.jpg", { type: "image/jpeg" });
  let finish;
  prepare(() => new Promise(resolve => { finish = resolve; }));
  await choosePhoto(file);
  await React.act(async () => document.querySelector('[aria-label="Close edit product"]').click());
  assert.equal(closed(), 1);
  assert.equal(prepared[0].signal.aborted, true);
  await React.act(async () => finish(file));
  assert.equal(document.querySelector('[aria-label="Selected photos"]'), null);
  assert.equal(calls.length, 0);
}, existingItem));
