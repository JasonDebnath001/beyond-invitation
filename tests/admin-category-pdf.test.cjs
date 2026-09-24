const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { PDFDocument, PDFName } = require("pdf-lib");

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
    const scope = {
      exports, Buffer, URL, AbortController, AbortSignal, setTimeout, clearTimeout, console,
      Uint8Array, ArrayBuffer, ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === "server-only") return {};
        if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
        if (name.startsWith("./")) return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), `${name}.ts`)));
        return require(name);
      },
    };
    // pdf-lib validates Array instances; keep its inputs in the same JS realm.
    vm.runInThisContext(`(function(${Object.keys(scope).join(",")}) {\n${code}\n})`, { filename })(...Object.values(scope));
    return exports;
  }
  return load;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const item = (id, extra = {}) => ({ id, designNo: id, printName: `Card ${id}`, category: "Wedding Card", subject: "", code: id, active: true, visible: true, imageUrl: "front", updatedAt: "", hasDescription: true, ...extra });
const { pdfCategories, itemsForPdf, categoryPdfFilename, categoryPdfTitle, photosForPdf } = loader()("lib/admin/item-pdf-selection.ts");

test("PDF photos exclude videos before selecting four unique images", () => {
  const photos = photosForPdf([
    "https://cdn.example/card.MP4?download=1", "https://youtu.be/card",
    " /cards/front.PNG ", "/cards/front.PNG", "/cards/back.jpg?token=example",
    "/cards/tour.webm#preview", "/cards/detail%2Ewebp", "/cards/insert.avif",
    "/cards/fifth.png", "/cards/invalid%zz.png", "javascript:photo.png",
  ]);
  assert.deepEqual(plain(photos), ["/cards/front.PNG", "/cards/back.jpg?token=example", "/cards/detail%2Ewebp", "/cards/insert.avif"]);
  assert.deepEqual(plain(photosForPdf(["/tour.mov", "/tour.mp4", "/tour.m4v", "/tour.webm"])), []);
});

test("Christian and Muslim exports use Wedding Cards without changing category choices", () => {
  const categories = pdfCategories([]);
  for (const type of ["christian", "muslim"]) {
    const category = categories.find((entry) => entry.value === `collection:${type}`);
    assert.notEqual(category.label, "Wedding Cards");
    assert.equal(categoryPdfTitle(category.label), "Wedding Cards");
    assert.equal(categoryPdfFilename(categoryPdfTitle(category.label)), "wedding-cards-catalogue.pdf");
  }
  assert.equal(categoryPdfTitle("Hindu Wedding Cards"), "Hindu Wedding Cards");
});

test("PDF category selection covers every page, uses exact membership, and preserves website visibility rules", () => {
  const items = Array.from({ length: 53 }, (_, n) => item(String(n + 1)));
  items.push(item("hidden", { visible: false }), item("disabled", { active: false }), item("wrong", { category: "Wedding Card Box" }));
  const categories = pdfCategories(items);
  const christian = categories.find((entry) => entry.value === "collection:christian");
  assert.equal(christian.label, "Christian Wedding Cards");
  const selected = itemsForPdf(items, christian);
  assert.equal(selected.length, 53);
  assert.deepEqual(plain(selected.slice(0, 3).map((row) => row.id)), ["1", "2", "3"]);
  assert.equal(itemsForPdf(items, categories.find((entry) => entry.value === "category:Wedding Card")).length, 55);
  assert.equal(categoryPdfFilename(christian.label), "christian-wedding-cards-catalogue.pdf");
  assert.equal(categoryPdfFilename('../../<>:"'), "category-catalogue.pdf");
});

test("PDF data stays within the selected company and items, paginates galleries, and removes duplicate photos", async () => {
  const rows = Array.from({ length: 1001 }, (_, n) => ({ company_id: "company-a", item_id: "1", image_url: `photo-${n}.png`, is_deleted: false }));
  rows.unshift({ ...rows[0], image_url: "card.mp4" }, { ...rows[0] });
  rows.push({ ...rows[0], company_id: "company-b", image_url: "private" }, { ...rows[0], item_id: "hidden", image_url: "hidden" }, { ...rows[0], is_deleted: true, image_url: "deleted" });
  const ranges = [];
  let company;
  const db = { from(table) {
    assert.equal(table, "item_images");
    const filters = [];
    let range;
    const query = {
      select() { return query; }, order() { return query; }, abortSignal() { return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
      range(start, end) { range = [start, end]; ranges.push(range); return query; },
      then(resolve) { return Promise.resolve({ data: rows.filter((row) => filters.every((filter) => filter(row))).slice(range[0], range[1] + 1), error: null }).then(resolve); },
    };
    return query;
  } };
  const { loadCategoryPdfData } = loader({
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => db },
    "./item-service": { loadItemLibrary: async (id) => {
      company = id;
      return { companyId: id, items: [item("1", { imageUrl: "photo-0.png", printName: "" }), item("hidden", { visible: false }), item("other", { category: "Box" })] };
    } },
  })("lib/admin/item-pdf-service.ts");
  const signal = new AbortController().signal;
  const result = await loadCategoryPdfData("company-a", "collection:christian", signal);
  assert.equal(company, "company-a");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "1");
  assert.equal(result.title, "Wedding Cards");
  assert.deepEqual(plain(result.items[0].images), ["photo-0.png", "photo-1.png", "photo-2.png", "photo-3.png"]);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
  assert.equal((await loadCategoryPdfData("company-a", "collection:muslim", signal)).title, "Wedding Cards");
  await assert.rejects(loadCategoryPdfData("", "collection:christian", signal), (error) => error.status === 400);
  await assert.rejects(loadCategoryPdfData("company-a", "category:unknown", signal), (error) => error.status === 400);
  await assert.rejects(loadCategoryPdfData("company-a", "collection:hindu", signal), (error) => error.status === 404);
});

test("generated PDF uses one page per card, embeds only four photos and excludes videos", async () => {
  const { createCategoryPdf } = loader()("lib/admin/category-pdf.ts");
  const photo = await require("sharp")(path.resolve(__dirname, "../public/category/christian-wedding-cards.png")).flatten({ background: "white" }).jpeg().toBuffer();
  const urls = ["1.png", "2.png", "3.png", "4.png", "5.png"];
  const requested = [];
  const progress = [];
  const result = await createCategoryPdf({ title: "Christian Wedding Cards", items: [
    { id: "1", name: "Ivory floral wedding invitation with a beautifully detailed envelope and matching inserts", designNo: "101", images: ["video.mp4", ...urls, "1.png"] },
    { id: "2", name: "Card without photos", designNo: "102", images: ["video.webm"] },
    { id: "3", name: "Card with an unavailable photo", designNo: "103", images: ["broken.png"] },
  ] }, { loadPhoto: async (url) => {
    requested.push(url);
    if (url === "broken.png") throw new Error("Unavailable");
    return new Uint8Array(photo);
  }, onProgress: (message) => progress.push(message) });
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getTitle(), "Wedding Cards - Beyond Invitation");
  assert.equal(pdf.getPageCount(), 3);
  assert.equal(pdf.getPages().reduce((count, page) => count + (page.node.Resources().lookup(PDFName.of("XObject"))?.keys().length ?? 0), 0), 4);
  assert.deepEqual(requested, ["1.png", "2.png", "3.png", "4.png", "broken.png"]);
  assert.deepEqual(plain(result.missingPhotos), ["103: photo 1"]);
  assert.deepEqual(plain(result.noPhotoItems), ["102"]);
  assert.equal(progress.at(-1), "Saving PDF...");
  if (process.env.PDF_QA_OUTPUT) {
    fs.mkdirSync(path.dirname(process.env.PDF_QA_OUTPUT), { recursive: true });
    fs.writeFileSync(process.env.PDF_QA_OUTPUT, result.bytes);
  }
});

test("empty and cancelled exports never produce a download", async () => {
  const { createCategoryPdf } = loader()("lib/admin/category-pdf.ts");
  await assert.rejects(createCategoryPdf({ title: "Empty", items: [] }), /no items/);
  const controller = new AbortController();
  await assert.rejects(createCategoryPdf({ title: "Cancelled", items: [{ id: "1", name: "Card", designNo: "1", images: ["image.png"] }] }, {
    signal: controller.signal,
    loadPhoto: async () => { controller.abort(); throw new Error("aborted"); },
  }), /cancelled/);
});

test("dashboard downloads the full selected category, reports failures, and allows retry", async () => {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/admin" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const calls = [], downloads = [];
  const items = Array.from({ length: 53 }, (_, n) => item(String(n + 1)));
  const library = { companyId: "company-a", companies: [{ id: "company-a", name: "Company A" }], items };
  let fail = false;
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  const Dashboard = loader({
    "./ItemDashboard.module.css": {}, "./ProductEditorDialog": () => null, "./ProductPhoto": () => null,
    "next/image": () => null, "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/lib/admin/item-client": { readAdminJson: async (url) => {
      calls.push(url);
      if (!url.includes("view=pdf")) return library;
      if (fail) throw new Error("Photos could not be loaded. Please retry.");
      return { title: "Wedding Cards", items: items.map((entry) => ({ ...entry, name: entry.printName, images: ["front.png"] })) };
    } },
    "@/lib/admin/category-pdf": { createCategoryPdf: async (data, options) => {
      assert.equal(data.items.length, 53);
      assert.equal(document.querySelector('[aria-label="Company"]').disabled, true);
      options.onProgress("Saving PDF...");
      return { bytes: new Uint8Array([1, 2]), missingPhotos: ["1"], noPhotoItems: [] };
    } },
  }, { document: dom.window.document, Blob, URL: { createObjectURL: () => "blob:pdf", revokeObjectURL() {} }, setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms); timer.unref(); return timer; } })("components/admin/ItemDashboard.tsx").default;
  const root = createRoot(document.getElementById("root"));
  try {
    await React.act(async () => root.render(React.createElement(Dashboard)));
    const section = document.querySelector('[aria-label="Category PDF download"]');
    const button = section.querySelector("button");
    const photoToggle = section.querySelector('input[type="checkbox"]');
    assert.equal(photoToggle.checked, true);
    assert.equal(button.disabled, true);
    await React.act(async () => {
      section.querySelector("select").value = "collection:christian";
      section.querySelector("select").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.match(section.textContent, /53 card\(s\)/);
    fail = true;
    await React.act(async () => button.click());
    assert.match(document.querySelector('[role="alert"]').textContent, /Photos could not be loaded/);
    assert.equal(button.disabled, false);
    fail = false;
    await React.act(async () => button.click());
    assert.deepEqual(downloads, ["wedding-cards-catalogue.pdf"]);
    assert.match(calls.at(-1), /companyId=company-a&category=collection%3Achristian/);
    assert.match(calls.at(-1), /onlyWithPhotos=true/);
    assert.match(document.querySelector('[role="status"]').textContent, /53 card\(s\).*1 photo\(s\) could not be loaded/);
    await React.act(async () => photoToggle.click());
    await React.act(async () => button.click());
    assert.match(calls.at(-1), /onlyWithPhotos=false/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("photo-only exports keep gallery-only cards, skip empty/video-only cards by default, and allow opting out", async () => {
  let entries = [item("main", { imageUrl: "main.png" }), item("gallery", { imageUrl: "" }), item("empty", { imageUrl: "" }), item("video", { imageUrl: "movie.mp4" })];
  const gallery = [{ item_id: "gallery", image_url: "gallery.jpg" }];
  const db = { from() {
    const query = { select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; }, range() { return query; }, abortSignal() { return query; }, then(resolve) { return Promise.resolve({ data: gallery, error: null }).then(resolve); } };
    return query;
  } };
  const { loadCategoryPdfData } = loader({
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => db },
    "./item-service": { loadItemLibrary: async () => ({ items: entries }) },
  })("lib/admin/item-pdf-service.ts");
  const signal = new AbortController().signal;
  const filtered = await loadCategoryPdfData("company", "collection:christian", signal);
  assert.deepEqual(plain(filtered.items.map((entry) => entry.id)), ["gallery", "main"]);
  assert.equal(filtered.skippedItemCount, 2);
  const all = await loadCategoryPdfData("company", "collection:christian", signal, false);
  assert.equal(all.items.length, 4);
  assert.equal(all.skippedItemCount, 0);
  entries = [item("empty", { imageUrl: "" })];
  await assert.rejects(loadCategoryPdfData("company", "collection:christian", signal), (error) => error.status === 404 && /Only cards with photos/.test(error.message));
});

test("gallery queries use parallel 200-item chunks while retaining company scope", async () => {
  const entries = Array.from({ length: 601 }, (_, index) => item(String(index), { imageUrl: "main.png" }));
  const chunks = [];
  let active = 0, peak = 0;
  const db = { from() {
    let ids;
    const query = {
      select() { return query; }, order() { return query; }, range() { return query; }, abortSignal() { return query; },
      eq(key, value) { if (key === "company_id") assert.equal(value, "company-a"); return query; },
      in(key, values) { assert.equal(key, "item_id"); ids = values; return query; },
      then(resolve) {
        chunks.push(ids);
        peak = Math.max(peak, ++active);
        return new Promise((done) => setTimeout(() => { active--; done({ data: [], error: null }); }, 1)).then(resolve);
      },
    };
    return query;
  } };
  const { loadCategoryPdfData } = loader({
    "@/lib/supabase/admin": { getSupabaseAdminClient: () => db },
    "./item-service": { loadItemLibrary: async () => ({ items: entries }) },
  })("lib/admin/item-pdf-service.ts");
  const result = await loadCategoryPdfData("company-a", "collection:christian", new AbortController().signal);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [200, 200, 200, 1]);
  assert.equal(peak, 4);
  assert.equal(new Set(chunks.flat()).size, 601);
  assert.equal(result.items.length, 601);
});

test("photo pool bounds concurrency, deduplicates URLs, and cancels queued and active work", async () => {
  const { createPdfPhotoPool } = loader()("lib/admin/pdf-photo-pool.ts");
  const controller = new AbortController();
  const gates = [], signals = [];
  let active = 0, peak = 0;
  const pool = createPdfPhotoPool((url, signal) => {
    signals.push(signal);
    peak = Math.max(peak, ++active);
    return new Promise((resolve) => gates.push(() => { active--; resolve(url); }));
  }, controller.signal);
  const first = pool.get("0");
  assert.equal(pool.get("0"), first);
  const pending = [first, ...Array.from({ length: 19 }, (_, index) => pool.get(String(index + 1)))];
  await new Promise(setImmediate);
  assert.equal(gates.length, 8);
  gates[0](); gates[1]();
  await new Promise(setImmediate);
  assert.equal(gates.length, 10);
  assert.equal(peak, 8);
  controller.abort();
  const values = await Promise.all(pending);
  assert.deepEqual(values.slice(0, 2), ["0", "1"]);
  assert.ok(values.slice(2).every((value) => value === null));
  assert.ok(signals.every((signal) => signal.aborted));
  gates.slice(2).forEach((done) => done());
  await new Promise(setImmediate);
  assert.equal(gates.length, 10, "queued jobs must never start after cancellation");
  pool.dispose();
});

test("PDF downloads six items ahead and embeds each repeated URL once", async () => {
  const { createCategoryPdf } = loader()("lib/admin/category-pdf.ts");
  const jpeg = new Uint8Array(await require("sharp")({ create: { width: 4, height: 4, channels: 3, background: "white" } }).jpeg().toBuffer());
  const calls = [];
  let releaseFirst, ready;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const prefetched = new Promise((resolve) => { ready = resolve; });
  const result = createCategoryPdf({ title: "Wedding Cards", items: Array.from({ length: 12 }, (_, n) => ({ id: String(n), name: `Card ${n}`, designNo: String(n), images: ["shared.jpg", `${n}.jpg`] })) }, {
    loadPhoto: async (url) => {
      calls.push(url);
      if (calls.length === 8) ready();
      if (url === "0.jpg") await first;
      return jpeg;
    },
  });
  await prefetched;
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["shared.jpg", "0.jpg", "1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg"]);
  releaseFirst();
  const { bytes } = await result;
  assert.equal(calls.length, 13);
  assert.equal(new Set(calls).size, 13);
  const pdf = await PDFDocument.load(bytes);
  const references = pdf.getPages().flatMap((page) => page.node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => ref.toString()));
  assert.equal(references.length, 24);
  assert.equal(new Set(references).size, 13);
  assert.ok(!Buffer.from(bytes).includes(Buffer.from("/Type /ObjStm")));
});

test("PDF progress is throttled to 400ms and yields every ten pages", async () => {
  let clock = 0, yields = 0;
  class TestDate extends Date { static now() { const now = clock; clock += 100; return now; } }
  const { createCategoryPdf } = loader({}, {
    Date: TestDate,
    setTimeout: (callback, delay) => { if (delay === 0) yields++; return setTimeout(callback, delay); },
  })("lib/admin/category-pdf.ts");
  const progress = [];
  await createCategoryPdf({ title: "Wedding Cards", items: Array.from({ length: 31 }, (_, n) => ({ id: String(n), name: `Card ${n}`, designNo: String(n), images: [] })) }, { onProgress: (message) => progress.push({ message, time: clock }) });
  assert.equal(yields, 4, "three page batches and a final paint before saving");
  assert.equal(progress.at(-1).message, "Saving PDF...");
  for (let index = 1; index < progress.length - 1; index++) assert.ok(progress[index].time - progress[index - 1].time >= 400);
  assert.ok(progress.length < 12);
});

test("repeated Unicode text is laid out, rasterized and embedded once per style", async () => {
  const png = await require("sharp")({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  let canvases = 0, encodes = 0;
  const { createCategoryPdf } = loader({}, { document: { createElement() {
    canvases++;
    return { getContext: () => ({ measureText: (text) => ({ width: text.length * 6 }), scale() {}, fillText() {} }), toBlob: (done) => { encodes++; done(new Blob([png], { type: "image/png" })); } };
  } } })("lib/admin/category-pdf.ts");
  const { bytes } = await createCategoryPdf({ title: "निमंत्रण", items: Array.from({ length: 3 }, (_, n) => ({ id: String(n), name: "शादी ₹", designNo: String(n), images: [] })) });
  assert.equal(canvases, 2);
  assert.equal(encodes, 2);
  const pdf = await PDFDocument.load(bytes);
  const references = pdf.getPages().flatMap((page) => page.node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => ref.toString()));
  assert.equal(references.length, 6);
  assert.equal(new Set(references).size, 2);
});

test("Supabase photo transformations request 1000px at quality 72 and preserve other URLs", () => {
  const { transformedPdfPhotoUrl } = loader()("lib/admin/pdf-photo.ts");
  const original = "https://project.supabase.co/storage/v1/object/public/item_images/Card%201.webp?v=2";
  const transformed = new URL(transformedPdfPhotoUrl(original));
  assert.equal(transformed.pathname, "/storage/v1/render/image/public/item_images/Card%201.webp");
  assert.equal(transformed.searchParams.get("width"), "1000");
  assert.equal(transformed.searchParams.get("quality"), "72");
  assert.equal(transformed.searchParams.get("v"), "2");
  for (const url of ["/photo.jpg", "https://cdn.example/photo.jpg", "https://project.supabase.co/storage/v1/object/sign/item_images/photo.jpg?token=example"])
    assert.equal(transformedPdfPhotoUrl(url), url);
});

test("modern photo loading uses async raw-byte encoding and falls back when a transform fails", async () => {
  const requests = [], encodes = [];
  let closed = 0;
  class Canvas {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { fillRect() {}, drawImage() {} }; }
    async convertToBlob(options) {
      encodes.push({ width: this.width, height: this.height, ...options });
      return new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" });
    }
  }
  const { loadPdfPhoto } = loader({}, {
    window: { location: { origin: "http://localhost" } }, OffscreenCanvas: Canvas,
    createImageBitmap: async (blob) => {
      assert.equal(blob.type, "image/webp");
      return { width: 1800, height: 900, close() { closed++; } };
    },
    fetch: async (url, options) => {
      requests.push(url);
      assert.equal(options.credentials, "omit");
      return url.includes("/render/") ? new Response("Unavailable", { status: 503 }) :
        new Response(new Uint8Array([1]), { headers: { "content-type": "image/webp" } });
    },
    Image: class { constructor() { throw new Error("Legacy decoding should not run"); } },
  })("lib/admin/pdf-photo.ts");
  const original = "https://project.supabase.co/storage/v1/object/public/item_images/photo.webp";
  const bytes = await loadPdfPhoto(original);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes], [255, 216, 255, 217]);
  assert.equal(requests.length, 2);
  assert.match(requests[0], /render\/image\/public\/.*width=1000&quality=72/);
  assert.equal(requests[1], original);
  assert.deepEqual(encodes, [{ width: 1000, height: 500, type: "image/jpeg", quality: 0.72 }]);
  assert.equal(closed, 1);
});

test("photo loading retains an async canvas fallback when OffscreenCanvas is unavailable", async () => {
  const sources = [], encodes = [];
  class LegacyAbortController extends AbortController {
    constructor() {
      super();
      Object.defineProperty(this.signal, "throwIfAborted", { value: undefined });
    }
  }
  class Photo {
    naturalWidth = 600;
    naturalHeight = 1200;
    set src(value) {
      if (!value) return;
      sources.push(value);
      assert.equal(this.crossOrigin, "anonymous");
      queueMicrotask(() => this.onload?.());
    }
  }
  const { loadPdfPhoto } = loader({}, {
    window: { location: { origin: "http://localhost" } }, OffscreenCanvas: undefined, createImageBitmap: undefined, Image: Photo, AbortController: LegacyAbortController,
    document: { createElement() { return {
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob(done, type, quality) {
        encodes.push({ width: this.width, height: this.height, type, quality });
        queueMicrotask(() => done(new Blob([new Uint8Array([1, 2])], { type })));
      },
      toDataURL() { throw new Error("Base64 encoding must not run"); },
    }; } },
  })("lib/admin/pdf-photo.ts");
  assert.deepEqual([...await loadPdfPhoto("/photo.png")], [1, 2]);
  assert.deepEqual(sources, ["http://localhost/photo.png"]);
  assert.deepEqual(encodes, [{ width: 500, height: 1000, type: "image/jpeg", quality: 0.72 }]);
});

test("cancelled photo decoding releases late bitmaps and never retries the original URL", async () => {
  const controller = new AbortController();
  const requests = [];
  let decode, decoding, closed = 0;
  const started = new Promise((resolve) => { decoding = resolve; });
  const pendingBitmap = new Promise((resolve) => { decode = resolve; });
  class Canvas { convertToBlob() { throw new Error("Cancelled encoding must not start"); } }
  const { loadPdfPhoto } = loader({}, {
    window: { location: { origin: "http://localhost" } }, OffscreenCanvas: Canvas,
    createImageBitmap: () => { decoding(); return pendingBitmap; },
    fetch: async (url) => { requests.push(url); return new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }); },
  })("lib/admin/pdf-photo.ts");
  const result = loadPdfPhoto("https://project.supabase.co/storage/v1/object/public/item_images/photo.png", controller.signal);
  await started;
  controller.abort();
  await assert.rejects(result, /cancelled/);
  decode({ width: 10, height: 10, close() { closed++; } });
  await new Promise(setImmediate);
  assert.equal(closed, 1);
  assert.equal(requests.length, 1);
});
