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
    return `data:image/jpeg;base64,${photo.toString("base64")}`;
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
    assert.match(document.querySelector('[role="status"]').textContent, /53 card\(s\).*1 photo\(s\) could not be loaded/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
