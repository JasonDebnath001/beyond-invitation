const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "..", file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Buffer, URL, File, FormData, console, AbortController, AbortSignal, setTimeout, clearTimeout, Error,
      ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === "server-only") return {};
        if (name === "@/lib/supabase/admin") return { getSupabaseAdminClient() { throw new Error("No live database in tests"); } };
        if (name.startsWith("./") || name.startsWith("@/")) {
          const target = name.startsWith("@/") ? path.resolve(__dirname, "..", name.slice(2)) : path.resolve(path.dirname(filename), name);
          return load(`${target}.${fs.existsSync(`${target}.ts`) ? "ts" : "tsx"}`);
        }
        return require(name);
      },
    });
    return exports;
  }
  return load;
}

const plain = value => JSON.parse(JSON.stringify(value));
const companyId = "11111111-1111-4111-a111-111111111111";
const itemId = "22222222-2222-4222-a222-222222222222";
const uploadId = "33333333-3333-4333-a333-333333333333";
const otherId = "44444444-4444-4444-a444-444444444444";
const base = "https://project.supabase.co/storage/v1/object/public/item_images/";
const videoPath = `dashboard/${companyId}/${itemId}/videos/${uploadId}.mp4`;
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(4), Buffer.from("isommp42")]);
const input = { action: "prepare", companyId, itemId, uploadId, contentType: "video/mp4", size: mp4.length, expectedVideoUrl: "" };
const service = loader()("lib/admin/item-video.ts");

function fixture() {
  const tables = {
    companies: [{ id: companyId, is_active: true }],
    items: [{ id: itemId, company_id: companyId, video_url: null, image_url: base + "photo.jpg", print_name: "Card 1" }],
  };
  const objects = new Map();
  const operations = [];
  const db = {
    tables, objects, operations, beforeUpdate: null, failUpdate: false,
    storage: { from(bucket) {
      assert.equal(bucket, "item_images");
      return {
        getPublicUrl: key => ({ data: { publicUrl: base + key } }),
        async exists(key) { return { data: objects.has(key), error: objects.has(key) ? null : { status: 400, message: "Not found" } }; },
        async createSignedUploadUrl(key, options) {
          operations.push({ action: "sign", key, options: plain(options) });
          return { data: { signedUrl: "https://storage.test/upload?token=secret" }, error: null };
        },
        async info(key) { return { data: objects.get(key), error: objects.has(key) ? null : { message: "Not found" } }; },
      };
    } },
    from(table) {
      assert.ok(table in tables, `Unexpected table: ${table}`);
      let patch;
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => row[key] === value); return query; },
        update(value) { patch = plain(value); return query; },
        async maybeSingle() {
          if (patch && db.beforeUpdate) { const callback = db.beforeUpdate; db.beforeUpdate = null; callback(); }
          const row = tables[table].find(row => filters.every(filter => filter(row)));
          if (patch && db.failUpdate) { db.failUpdate = false; return { data: null, error: { message: "Offline" } }; }
          if (patch && row) { Object.assign(row, patch); operations.push({ action: "update", patch }); }
          return { data: row ? { ...row } : null, error: null };
        },
      };
      return query;
    },
  };
  db.upload = (info = { size: mp4.length, contentType: "video/mp4" }) => objects.set(videoPath, { ...info, metadata: {} });
  return db;
}

test("video requests validate item scope, supported formats and the 50 MB limit", () => {
  assert.deepEqual(plain(service.parseItemVideoRequest(input)), input);
  for (const patch of [{ companyId: "bad" }, { itemId: "../other" }, { uploadId: "bad" }, { action: "delete" }, { contentType: "image/jpeg" }, { size: 0 }, { size: 50 * 1024 * 1024 + 1 }, { size: "20" }, { expectedVideoUrl: null }]) {
    assert.throws(() => service.parseItemVideoRequest({ ...input, ...patch }));
  }
  const fields = loader()("lib/admin/item-video-fields.ts");
  assert.equal(fields.productVideoType("Card.MP4", ""), "video/mp4");
  assert.equal(fields.productVideoType("image.jpg", "video/mp4"), undefined);
  assert.equal(fields.videoSourceForUrl("https://youtu.be/abc"), "youtube");
  assert.equal(fields.videoSourceForUrl("https://youtube.com.example.test/video.mp4"), "upload");
});

test("video preparation scopes the signed path to the selected active company's item without changing it", async () => {
  const db = fixture();
  const result = await service.saveItemVideo(input, db);
  assert.equal(result.url, base + videoPath);
  assert.deepEqual(db.operations, [{ action: "sign", key: videoPath, options: { upsert: false } }]);
  assert.equal(db.tables.items[0].video_url, null);
  await assert.rejects(service.saveItemVideo({ ...input, itemId: otherId }, db), error => error.status === 404);
  db.tables.items[0].company_id = otherId;
  await assert.rejects(service.saveItemVideo(input, db), error => error.status === 404);
  db.tables.companies[0].is_active = false;
  await assert.rejects(service.saveItemVideo(input, db), error => error.status === 404);
  assert.equal(db.operations.length, 1);
});

test("completion verifies stored bytes then attaches only the selected item's video, preserving photos", async () => {
  const db = fixture();
  db.tables.items.push({ id: otherId, company_id: companyId, video_url: "https://example.test/other.mp4" });
  db.upload();
  const result = await service.saveItemVideo({ ...input, action: "complete" }, db, async url => { assert.equal(url, base + videoPath); return mp4; });
  assert.equal(result.saved, true);
  assert.equal(db.tables.items[0].video_url, result.url);
  assert.equal(db.tables.items[0].video_source, "upload");
  assert.equal(db.tables.items[0].image_url, base + "photo.jpg");
  assert.equal(db.tables.items[0].print_name, "Card 1");
  assert.equal(db.tables.items[1].video_url, "https://example.test/other.mp4");
});

test("completion rejects incomplete, mismatched and non-video uploads", async () => {
  const db = fixture();
  const complete = () => service.saveItemVideo({ ...input, action: "complete" }, db, async () => mp4);
  await assert.rejects(complete(), /incomplete/);
  db.upload({ size: mp4.length + 1, contentType: "video/mp4" });
  await assert.rejects(complete(), /does not match/);
  db.upload({ size: mp4.length, contentType: "text/html" });
  await assert.rejects(complete(), /does not match/);
  db.upload();
  await assert.rejects(service.saveItemVideo({ ...input, action: "complete" }, db, async () => Buffer.from("<html>not video</html>")), /not a valid/);
  const avif = Buffer.from(mp4);
  avif.write("avif", 8); avif.write("mif1avif", 16);
  assert.equal(service.videoSignatureMatches(avif, "video/mp4"), false);
  assert.equal(service.videoSignatureMatches(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("webm")]), "video/webm"), true);
  assert.equal(service.videoSignatureMatches(mp4, "video/webm"), false);
  assert.equal(db.tables.items[0].video_url, null);
});

test("video retries reuse uploaded bytes and recover failed writes and lost success responses", async () => {
  const db = fixture();
  db.upload();
  assert.equal((await service.saveItemVideo(input, db)).uploaded, true);
  db.failUpdate = true;
  await assert.rejects(service.saveItemVideo({ ...input, action: "complete" }, db, async () => mp4), /Retry to finish/);
  assert.equal(db.tables.items[0].video_url, null);
  await service.saveItemVideo({ ...input, action: "complete" }, db, async () => mp4);
  assert.equal((await service.saveItemVideo(input, db)).saved, true);
  assert.equal((await service.saveItemVideo({ ...input, action: "complete" }, db, async () => { throw new Error("Should not re-read bytes"); })).saved, true);
  assert.deepEqual(db.operations.map(op => op.action), ["update"]);
});

test("replacing a video preserves newer changes, including edits made during verification", async () => {
  const db = fixture();
  const old = "https://example.test/old.mp4";
  const newer = "https://example.test/newer.mp4";
  db.tables.items[0].video_url = old;
  await assert.rejects(service.saveItemVideo(input, db), error => error.status === 409);
  db.upload();
  db.beforeUpdate = () => { db.tables.items[0].video_url = newer; };
  await assert.rejects(service.saveItemVideo({ ...input, expectedVideoUrl: old, action: "complete" }, db, async () => mp4), error => error.status === 409);
  assert.equal(db.tables.items[0].video_url, newer);
  await service.saveItemVideo({ ...input, expectedVideoUrl: newer, action: "complete" }, db, async () => mp4);
  assert.equal(db.tables.items[0].video_url, base + videoPath);
});

test("video endpoint requires same-origin JSON, validates input and refreshes the catalogue only after attaching", async () => {
  const calls = [], invalidations = [];
  const route = loader({
    "next/cache": { revalidateTag: tag => invalidations.push(tag), revalidatePath() {} },
    "@/lib/admin/item-video": { ...service, saveItemVideo: async body => { calls.push(body); return body.action === "complete" ? { saved: true, url: base + videoPath } : { signedUrl: "https://storage.test/upload" }; } },
    // Use the same error class as the service parser for the route's status checks.
    "@/lib/admin/item-create": { ItemCreateError: (() => { try { service.parseItemVideoRequest(null); } catch (error) { return error.constructor; } })() },
  })("app/api/admin/items/videos/route.ts");
  const request = (body = input, headers = {}) => new Request("http://localhost/api/admin/items/videos", {
    method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
  assert.equal((await route.POST(request(input, { origin: "https://other.test" }))).status, 403);
  assert.equal((await route.POST(request(input, { "content-type": "video/mp4" }))).status, 415);
  assert.equal((await route.POST(request("broken"))).status, 400);
  assert.equal((await route.POST(request({ ...input, itemId: "bad" }))).status, 400);
  assert.equal((await route.POST(request("x".repeat(8193)))).status, 413);
  assert.equal(calls.length, 0);
  const prepared = await route.POST(request());
  assert.equal(prepared.status, 200);
  assert.equal(prepared.headers.get("cache-control"), "private, no-store");
  assert.equal(invalidations.length, 0);
  assert.equal((await route.POST(request({ ...input, action: "complete" }))).status, 200);
  assert.deepEqual(invalidations, ["catalogue"]);
});

function clientFixture() {
  const calls = [], uploads = [], progress = [];
  let uploaded = false, saved = false;
  const state = { failUpload: false, failComplete: false, holdUpload: false };
  class XHR {
    upload = {};
    headers = {};
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(file) {
      uploads.push(this);
      this.file = file;
      if (state.holdUpload) return;
      if (state.failUpload) { this.onerror(); return; }
      uploaded = true;
      this.upload.onprogress({ lengthComputable: true, loaded: file.size, total: file.size });
      this.status = 200; this.onload();
    }
    abort() { this.onabort(); }
  }
  const client = loader({}, {
    XMLHttpRequest: XHR,
    fetch: async (url, init) => {
      assert.equal(url, "/api/admin/items/videos");
      const body = JSON.parse(init.body); calls.push(body);
      if (init.signal.aborted) throw new Error("Aborted");
      if (body.action === "prepare") return { ok: true, json: async () => ({ url: base + videoPath, saved, uploaded, signedUrl: "https://storage.test/upload?token=secret" }) };
      if (state.failComplete) return { ok: false, json: async () => ({ error: "Retry to attach" }) };
      saved = true;
      return { ok: true, json: async () => ({ saved: true, url: base + videoPath }) };
    },
  })("lib/admin/item-video-client.ts");
  const file = new File([mp4], "card.mp4", { type: "video/mp4" });
  return { ...state, state, calls, uploads, progress, file, run: options => client.uploadItemVideo(input, file, { onProgress: message => progress.push(message), ...options }) };
}

test("browser uploads video bytes straight to the signed storage URL and retries only unfinished work", async () => {
  const f = clientFixture();
  f.state.failComplete = true;
  await assert.rejects(f.run(), /Retry to attach/);
  assert.deepEqual(f.calls.map(call => call.action), ["prepare", "complete"]);
  assert.equal(f.uploads[0].method, "PUT");
  assert.equal(f.uploads[0].url, "https://storage.test/upload?token=secret");
  assert.equal(f.uploads[0].file, f.file);
  assert.equal(f.uploads[0].headers["Content-Type"], "video/mp4");
  assert.ok(f.progress.includes("Uploading video... 100%"));
  f.state.failComplete = false;
  assert.equal((await f.run()).saved, true);
  assert.equal((await f.run()).saved, true);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.calls.map(call => call.action), ["prepare", "complete", "prepare", "complete", "prepare"]);
  assert.ok(f.calls.every(call => call.itemId === itemId && call.uploadId === uploadId));
});

test("browser does not attach failed or cancelled video transfers", async () => {
  const f = clientFixture();
  f.state.failUpload = true;
  await assert.rejects(f.run(), /interrupted/);
  assert.deepEqual(f.calls.map(call => call.action), ["prepare"]);
  f.state.failUpload = false;
  f.state.holdUpload = true;
  const controller = new AbortController();
  const pending = f.run({ signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.ok(f.calls.every(call => call.action === "prepare"));
});

async function withEditor(run, options = {}) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/admin" });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const calls = [], saved = [], revoked = [];
  let failVideo = false, failPhotos = false, failDetails = false;
  class PreviewURL extends URL {
    static createObjectURL(file) { return `blob:${file.name}`; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const Editor = loader({
    "./ItemDashboard.module.css": {},
    "./ProductPhoto": () => null,
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/lib/admin/item-photo-client": { prepareProductPhoto: async file => file },
    "@/lib/admin/item-video-client": { uploadItemVideo: async (body, file) => {
      calls.push({ action: "video", body: plain(body), file });
      if (failVideo) throw new Error("Upload interrupted");
      return { saved: true, url: base + videoPath };
    } },
  }, {
    FormData: dom.window.FormData, crypto: require("node:crypto").webcrypto, URL: PreviewURL,
    fetch: async (url, init) => {
      const photo = url.endsWith("/photos");
      calls.push({ action: photo ? "photo" : "details", method: init.method, body: photo ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body) });
      return { ok: !(photo ? failPhotos : failDetails), json: async () => ({ id: itemId, designNo: "CARD-1", error: "Save failed" }) };
    },
  })("components/admin/ProductEditorDialog.tsx").default;
  const item = {
    id: itemId, designNo: "CARD-1", updatedAt: "2026-09-24T00:00:00Z", fields: {}, images: [],
    values: { name: "CARD-1", video_url: "https://example.test/old.mp4", video_source: "upload" },
  };
  const data = { companyId, companies: [{ id: companyId, name: "Company" }], referenceOptions: { item_groups: [{ id: otherId, name: "Cards" }] }, itemTypes: ["Goods"], items: [item] };
  const root = createRoot(document.getElementById("root"));
  const change = (selector, value) => React.act(async () => {
    const control = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), "value").set.call(control, value);
    control.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  const choose = (file = new dom.window.File([mp4], "card.mp4", { type: "video/mp4" }), selector = '[aria-label="Choose product video"]') => React.act(async () => {
    const control = document.querySelector(selector);
    Object.defineProperty(control, "files", { configurable: true, value: [file] });
    control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  const submit = () => React.act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  const click = text => React.act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === text).click());
  try {
    await React.act(async () => root.render(React.createElement(Editor, { data, item: options.newItem ? undefined : item, onClose() {}, onSaved: product => saved.push(product) })));
    await run({ calls, saved, revoked, change, choose, submit, click, dom, failVideo: value => { failVideo = value; }, failPhotos: value => { failPhotos = value; }, failDetails: value => { failDetails = value; } });
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("editor previews and queues one video until save, and cancellation preserves the existing video", async () => withEditor(async f => {
  assert.equal(document.querySelector("video").src, "https://example.test/old.mp4");
  await f.choose();
  assert.equal(document.querySelector("video").src, "blob:card.mp4");
  assert.equal(document.querySelector('[name="video_url"]').disabled, true);
  assert.equal(f.calls.length, 0);
  await f.click("Cancel selected video");
  assert.equal(document.querySelector("video").src, "https://example.test/old.mp4");
  assert.ok(f.revoked.includes("blob:card.mp4"));
  await f.choose(new f.dom.window.File(["image"], "image.jpg", { type: "image/jpeg" }));
  assert.match(document.querySelector('[role="alert"]').textContent, /MP4 or WebM/);
  assert.equal(f.calls.length, 0);
}));

test("editor saves video for the selected item after details, preserving the ID across retries", async () => withEditor(async f => {
  await f.choose();
  f.failVideo(true);
  await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details", "video"]);
  assert.deepEqual(f.calls[0].body.values, {});
  assert.equal(f.calls[1].body.itemId, itemId);
  assert.equal(f.calls[1].body.companyId, companyId);
  assert.equal(f.calls[1].body.expectedVideoUrl, "https://example.test/old.mp4");
  assert.equal(f.saved.length, 0);
  assert.match(document.querySelector('[role="alert"]').textContent, /video could not be saved/);
  assert.equal(document.querySelector('[type="submit"]').textContent, "Retry video upload");
  assert.ok(document.querySelector('[aria-label="Choose product video"]').matches(":disabled"));
  f.failVideo(false);
  await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details", "video", "video"]);
  assert.equal(f.calls[1].body.uploadId, f.calls[2].body.uploadId);
  assert.equal(f.saved.length, 1);
}));

test("video upload waits for a successful item save", async () => withEditor(async f => {
  await f.choose(); f.failDetails(true); await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details"]);
  assert.equal(f.saved.length, 0);
  assert.equal(document.querySelector('[type="submit"]').textContent, "Save changes");
}));

test("video saved alongside a failed photo is not uploaded again on photo retry", async () => withEditor(async f => {
  await f.choose();
  const photoInput = [...document.querySelectorAll('input[type="file"]')].find(control => control.accept.includes("image/jpeg") && !control.getAttribute("aria-label")?.includes("replacement"));
  assert.ok(photoInput);
  await f.choose(new f.dom.window.File(["photo"], "photo.jpg", { type: "image/jpeg" }), `input[type="file"][accept="${photoInput.accept}"]`);
  f.failPhotos(true); await f.submit();
  assert.equal(document.querySelector('[type="submit"]').textContent, "Retry remaining photos");
  f.failPhotos(false); await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details", "photo", "video", "photo"]);
  assert.equal(f.saved.length, 1);
}));

test("video links and removals use item edits without uploading media", async () => withEditor(async f => {
  await f.change('[name="video_url"]', "https://youtu.be/abc");
  await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details"]);
  assert.deepEqual(f.calls[0].body.values, { video_url: "https://youtu.be/abc", video_source: "youtube" });
}));

test("remove video clears both item video fields on save", async () => withEditor(async f => {
  await f.click("Remove video");
  assert.equal(document.querySelector("video"), null);
  assert.equal(f.calls.length, 0);
  await f.submit();
  assert.deepEqual(f.calls[0].body.values, { video_url: "", video_source: "" });
}));

test("new products save first and attach the video to the newly created item", async () => withEditor(async f => {
  await f.change('[name="name"]', "CARD-1");
  await f.change('[name="group_id"]', otherId);
  await f.change('[name="item_type"]', "Goods");
  await f.choose(); await f.submit();
  assert.deepEqual(f.calls.map(call => call.action), ["details", "video"]);
  assert.equal(f.calls[0].method, "POST");
  assert.equal(f.calls[1].body.itemId, itemId);
  assert.equal(f.calls[1].body.expectedVideoUrl, "");
  assert.equal(f.saved.length, 1);
}, { newItem: true }));
