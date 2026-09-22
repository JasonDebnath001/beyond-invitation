const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const ExcelJS = require("exceljs");
const { NextRequest, NextResponse } = require("next/server");

function loader(extra = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, "..", file);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      Buffer,
      Date,
      URL,
      File,
      FormData,
      AbortSignal,
      console,
      process: { env: { SUPABASE_SECRET_KEY: "test-only-key" } },
      require(name) {
        if (name === "server-only") return {};
        if (name in extra) return extra[name];
        if (name.startsWith("./"))
          return load(
            path.relative(
              path.resolve(__dirname, ".."),
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          );
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
        return require(name);
      },
    });
    return exports;
  }
  return load;
}
const load = loader({
  "@/lib/supabase/admin": {
    getSupabaseAdminClient() {
      throw new Error("No live database in tests");
    },
  },
});
const { parseItemUpload } = load("lib/admin/item-upload.ts");
const { planItemImport, importId } = load("lib/admin/item-plan.ts");
const { parseNewItemRequest, planNewItem } = load("lib/admin/item-create.ts");
const { parseItemEditRequest, planItemEdit } = load("lib/admin/item-edit.ts");
const { prepareItemPhoto, storeItemPhoto, appendItemPhoto } = load("lib/admin/item-photo.ts");
const { signPreview, verifyPreview, commitItemPlan, adminData } = load(
  "lib/admin/item-service.ts",
);
const plain = (value) => JSON.parse(JSON.stringify(value));
const id = "11111111-1111-4111-a111-111111111111";
const item = (overrides = {}) => ({
  id,
  company_id: "company",
  name: "AC-507",
  code: "IT1",
  print_name: "Old title",
  updated_at: "2026-09-19T00:00:00Z",
  group_id: "group",
  item_type: "Finished",
  is_active: true,
  ...overrides,
});
const context = (items = [item()], overrides = {}) => ({
  companyId: "company",
  sharedCompanyIds: ["shared"],
  items,
  lookups: {
    item_groups: [
      { id: "group", name: "Cards", company_id: "company", is_active: true },
    ],
    item_categories: [
      {
        id: "category",
        name: "Wedding Cards",
        company_id: "shared",
        is_active: true,
      },
    ],
    subjects: [
      {
        id: "subject",
        name: "Hindu Wedding Card",
        company_id: "shared",
        is_active: true,
      },
    ],
  },
  ...overrides,
});
const parsed = (...values) => ({
  rows: values.map((values, index) => ({ row: index + 2, values, errors: [] })),
  warnings: [],
  headers: [],
});

const editPayload = (values = {}, overrides = {}) => ({ companyId: "company", id, expectedUpdatedAt: item().updated_at, values, ...overrides });
const editRequest = (payload, origin = "http://localhost") => new Request("http://localhost/api/admin/items", {
  method: "PATCH", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(payload),
});

function libraryFixture() {
  const db = fakeDb([
    item({ item_category_id: "category", subject_id: "subject", web_description: "Full description", image_url: "main.jpg", show_on_website: true, variant_of: "template" }),
    item({ id: "template", name: "Parent", code: "IT2", has_variants: true, item_type: "Raw Material", updated_at: "2020-01-01" }),
    item({ id: "other", company_id: "other-company", name: "Other company's item", updated_at: "2020-01-01" }),
  ]);
  db.tables.companies = [
    { id: "company", name: "Catalogue", is_shared: true, is_active: true },
    { id: "other-company", name: "Other", is_shared: false, is_active: true },
  ];
  Object.assign(db.tables, context().lookups);
  db.tables.item_images = [
    { id: "photo1", company_id: "company", item_id: id, image_url: "front.jpg", sort_order: 0, created_at: "2020-01-01", is_deleted: false },
    { id: "photo2", company_id: "company", item_id: id, image_url: "back.jpg", sort_order: 1, created_at: "2020-01-01", is_deleted: false },
    { id: "deleted", company_id: "company", item_id: id, image_url: "deleted.jpg", is_deleted: true },
    { id: "unrelated", company_id: "company", item_id: "template", image_url: "unrelated.jpg", is_deleted: false },
  ];
  const route = loader({ "@/lib/supabase/admin": { getSupabaseAdminClient: () => db } })("app/api/admin/items/route.ts");
  return { db, route };
}

test("library GET returns compact company-scoped summaries without loading galleries or editor references", async () => {
  const { db, route } = libraryFixture();
  const response = await route.GET(new NextRequest("http://localhost/api/admin/items"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const data = await response.json();
  assert.equal(data.companyId, "company");
  assert.equal(data.items.length, 2);
  assert.deepEqual(data.items[0], {
    id, designNo: "AC-507", code: "IT1", printName: "Old title", category: "Wedding Cards", subject: "Hindu Wedding Card",
    visible: true, active: true, imageUrl: "main.jpg", hasDescription: true, updatedAt: item().updated_at,
  });
  assert.equal(data.items[1].hasDescription, false);
  assert.deepEqual(db.reads.map(read => read.table).sort(), ["companies", "item_categories", "items", "subjects"]);
  assert.ok(db.reads.every(read => read.signal instanceof AbortSignal));
  assert.equal(db.writes.length, 0);
  assert.equal((await route.GET(new NextRequest("http://localhost/api/admin/items?companyId=missing"))).status, 503);
});

test("editor GET returns only the selected item's fields and photos while preserving form options", async () => {
  const { db, route } = libraryFixture();
  const response = await route.GET(new NextRequest(`http://localhost/api/admin/items?view=editor&companyId=company&itemId=${id}`));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].id, id);
  assert.equal(data.items[0].values.web_description, "Full description");
  assert.deepEqual(data.items[0].images, ["main.jpg", "front.jpg", "back.jpg"]);
  assert.deepEqual(data.itemTypes, ["Finished", "Raw Material"]);
  assert.deepEqual(data.referenceOptions.items.map(item => item.id), ["template"]);
  const createResponse = await route.GET(new NextRequest("http://localhost/api/admin/items?view=editor&companyId=company"));
  const createData = await createResponse.json();
  assert.deepEqual(createData.items, []);
  assert.deepEqual(createData.itemTypes, data.itemTypes);
  assert.equal((await route.GET(new NextRequest("http://localhost/api/admin/items?view=editor&companyId=company&itemId=other"))).status, 404);
  assert.equal(db.writes.length, 0);
});

test("export GET keeps every template field and all company rows without loading gallery photos", async () => {
  const { db, route } = libraryFixture();
  const response = await route.GET(new NextRequest("http://localhost/api/admin/items?view=export&companyId=company"));
  assert.equal(response.status, 200);
  const data = await response.json();
  const fields = load("lib/admin/item-fields.ts").ITEM_FIELDS;
  assert.deepEqual(data.rows[0], plain(fields.map(field => field.label)));
  assert.equal(data.rows.length, 3);
  assert.ok(data.rows.every(row => row.length === fields.length));
  assert.equal(data.rows[1][data.rows[0].indexOf("Item Name")], "AC-507");
  assert.equal(data.rows[1][data.rows[0].indexOf("Item Description (Web)")], "Full description");
  assert.equal(db.reads.some(read => read.table === "item_images"), false);
  assert.deepEqual(Object.keys(data), ["rows"]);
});

test("cancelled library reads propagate to the database and return a retryable timeout error", async () => {
  const { db, route } = libraryFixture();
  const response = await route.GET(new NextRequest("http://localhost/api/admin/items", { signal: AbortSignal.abort() }));
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /took too long.*retry/);
  assert.equal(db.reads.length, 1);
  assert.equal(db.reads[0].signal.aborted, true);
});

test("manual editing preserves unsubmitted values, resolves references and explicitly clears optional fields", () => {
  const plan = planItemEdit(parseItemEditRequest(editPayload({ web_description: " Added details ", item_category_id: "category", print_name: "" })), context());
  assert.equal(plan.rows[0].status, "update");
  assert.deepEqual(plain(plan.rows[0].patch), { print_name: null, item_category_id: "category", web_description: "Added details" });
  assert.equal(plan.rows[0].expectedUpdatedAt, item().updated_at);
  assert.equal(planItemEdit(parseItemEditRequest(editPayload()), context()).rows[0].status, "unchanged");
  const data = adminData([], context([item({ brand_id: "disabled-brand", show_on_website: false, min_order_qty: 0 })]));
  assert.equal(data.items[0].values.brand_id, "disabled-brand");
  assert.equal(data.items[0].values.is_active, "N");
  assert.equal(data.items[0].values.show_on_website, "N");
  assert.equal(data.items[0].values.min_order_qty, "0");
});

test("manual editing rejects stale snapshots, wrong companies, forbidden fields and invalid changes", () => {
  assert.throws(() => planItemEdit(parseItemEditRequest(editPayload({}, { expectedUpdatedAt: "2020-01-01" })), context()), error => error.status === 409);
  assert.throws(() => planItemEdit(parseItemEditRequest(editPayload({}, { companyId: "other" })), context()), error => error.status === 404);
  for (const values of [{ name: "Renamed" }, { id }, { company_id: "other" }, { updated_at: "today" }, { min_order_qty: {} }]) assert.throws(() => parseItemEditRequest(editPayload(values)));
  for (const values of [{ code: "" }, { group_id: "" }, { min_order_qty: "0" }, { image_url: "javascript:alert(1)" }, { item_category_id: "unknown" }]) assert.throws(() => planItemEdit(parseItemEditRequest(editPayload(values)), context()));
});

test("PATCH saves changes to the selected item and invalidates the catalogue; stale or cross-origin writes do not save", async () => {
  const db = fakeDb();
  const invalidations = [];
  let reads = 0;
  const route = loader({
    "next/cache": { revalidateTag(tag) { invalidations.push(tag); }, revalidatePath() {} },
    "@/lib/admin/item-service": { loadItemContext: async () => { reads++; return { context: context(db.tables.items) }; }, commitItemPlan: plan => commitItemPlan(plan, db) },
  })("app/api/admin/items/route.ts");
  const payload = editPayload({ web_description: "Invitation description", image_url: "https://example.test/card.png" });
  assert.equal((await route.PATCH(editRequest(payload, "https://elsewhere.test"))).status, 403);
  assert.equal(reads, 0);
  const response = await route.PATCH(editRequest(payload));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, id);
  assert.equal(db.tables.items.length, 1);
  assert.equal(db.tables.items[0].web_description, "Invitation description");
  assert.equal(db.tables.items[0].print_name, "Old title");
  assert.deepEqual(invalidations, ["catalogue"]);
  assert.equal((await route.PATCH(editRequest(payload))).status, 409);
  assert.equal(db.writes.length, 1);
});

test("photo uploads decode real images and reject SVGs, spoofed files and oversized photos", async () => {
  const sharp = require("sharp");
  const bytes = await sharp({ create: { width: 12, height: 16, channels: 3, background: "#7b1c2e" } }).png().toBuffer();
  const prepared = await prepareItemPhoto(new File([bytes], "card.png", { type: "image/png" }));
  const metadata = await sharp(prepared).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 12);
  for (const file of [new File(["bad"], "spoof.png", { type: "image/png" }), new File(["<svg/>"], "card.svg", { type: "image/svg+xml" }), new File([Buffer.alloc(3 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })]) await assert.rejects(prepareItemPhoto(file));
  const writes = [];
  const db = { storage: { from(bucket) { assert.equal(bucket, "item_images"); return {
    upload: async (path, value, options) => { writes.push({ path, value, options }); return { error: null }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://example.test/${path}` } }),
  }; } } };
  const first = await storeItemPhoto(prepared, "company", id, db);
  const second = await storeItemPhoto(prepared, "company", id, db);
  assert.notEqual(first.path, second.path);
  assert.match(first.path, /^dashboard\/company\//);
  assert.equal(writes[0].options.upsert, false);
  assert.equal(writes[0].options.contentType, "image/webp");
});

test("PATCH photo saves set main photo and thumbnail only after validation; conflicts clean up only the new upload", async () => {
  const formRequest = (payload = editPayload()) => {
    const form = new FormData(); form.set("payload", JSON.stringify(payload)); form.set("photo", new File(["mock-photo"], "card.png", { type: "image/png" }));
    return new Request("http://localhost/api/admin/items", { method: "PATCH", headers: { Origin: "http://localhost" }, body: form });
  };
  for (const conflict of [false, true]) {
    const db = fakeDb(); const uploads = [], removed = [];
    const route = loader({
      "next/cache": { revalidateTag() {}, revalidatePath() {} },
      "@/lib/admin/item-service": { loadItemContext: async () => ({ context: context(db.tables.items) }), commitItemPlan: async plan => {
        if (conflict) db.tables.items[0].updated_at = "concurrent-edit";
        return commitItemPlan(plan, db);
      } },
      "@/lib/admin/item-photo": {
        prepareItemPhoto: async () => Buffer.from("validated"),
        storeItemPhoto: async (bytes, company, target) => { uploads.push({ company, target }); return { path: "new-photo", url: "https://example.test/new.webp" }; },
        discardItemPhoto: async path => removed.push(path),
      },
    })("app/api/admin/items/route.ts");
    const invalid = await route.PATCH(formRequest(editPayload({ min_order_qty: "0" })));
    assert.equal(invalid.status, 400);
    assert.equal(uploads.length, 0);
    const response = await route.PATCH(formRequest());
    assert.equal(response.status, conflict ? 409 : 200);
    assert.deepEqual(uploads, [{ company: "company", target: id }]);
    assert.deepEqual(removed, conflict ? ["new-photo"] : []);
    assert.equal(db.tables.items[0].image_url, conflict ? undefined : "https://example.test/new.webp");
    assert.equal(db.tables.items[0].thumb_url, conflict ? undefined : "https://example.test/new.webp");
  }
});

test("gallery appends preserve existing photos and main image, keep order and do not duplicate retries", async () => {
  const db = fakeDb([item({ image_url: "https://example.test/main.jpg" })]);
  db.tables.companies = [{ id: "company", is_active: true }];
  db.tables.item_images = [{ id: "old", company_id: "company", item_id: id, image_url: "https://example.test/old.jpg", sort_order: 4, is_deleted: false }];
  const bytes = await require("sharp")({ create: { width: 4, height: 4, channels: 3, background: "white" } }).png().toBuffer();
  const file = new File([bytes], "image.png", { type: "image/png" });
  const first = await appendItemPhoto(file, "company", id, "upload-one", db);
  await appendItemPhoto(file, "company", id, "upload-two", db);
  const replay = await appendItemPhoto(file, "company", id, "upload-one", db);
  assert.deepEqual(plain(replay), plain(first));
  assert.equal(db.tables.item_images.length, 3);
  assert.deepEqual(db.tables.item_images.map(row => row.sort_order), [4, 5, 6]);
  assert.equal(db.tables.items[0].image_url, "https://example.test/main.jpg");
  assert.equal(db.objects.size, 2);
});

test("gallery retry recovers storage and main-photo failures without duplicate rows or blobs", async () => {
  const db = fakeDb();
  db.tables.companies = [{ id: "company", is_active: true }];
  const bytes = await require("sharp")({ create: { width: 4, height: 4, channels: 3, background: "white" } }).png().toBuffer();
  const file = new File([bytes], "image.png", { type: "image/png" });
  db.failures.item_images = { message: "Temporary database failure" };
  await assert.rejects(appendItemPhoto(file, "company", id, "retry", db), /Temporary database failure/);
  assert.equal(db.objects.size, 1);
  db.failures.items = { message: "Could not update main" };
  await assert.rejects(appendItemPhoto(file, "company", id, "retry", db), /Retry to finish/);
  assert.equal(db.tables.item_images.length, 1);
  const recovered = await appendItemPhoto(file, "company", id, "retry", db);
  assert.equal(db.tables.item_images.length, 1);
  assert.equal(db.objects.size, 1);
  assert.equal(db.tables.items[0].image_url, recovered.url);
  assert.equal(db.tables.items[0].thumb_url, recovered.url);
  await assert.rejects(appendItemPhoto(file, "other", id, "new", db), error => error.status === 404);
  db.tables.companies.push({ id: "other", is_active: true });
  await assert.rejects(appendItemPhoto(file, "other", id, "new", db), error => error.status === 404);
  db.tables.item_images[0].is_deleted = true;
  await assert.rejects(appendItemPhoto(file, "company", id, "retry", db), error => error.status === 409);
});

test("admin gallery includes the main photo first, deduplicates and excludes deleted and unrelated photos", () => {
  const ctx = context([item({ image_url: "main" })], { images: [
    { id: "one", item_id: id, image_url: "second", sort_order: 2, created_at: "2026-01-01", is_deleted: false },
    { id: "two", item_id: id, image_url: "first", sort_order: 1, created_at: "2026-01-01", is_deleted: false },
    { id: "three", item_id: id, image_url: "main", sort_order: 0, created_at: "2026-01-01", is_deleted: false },
    { id: "four", item_id: id, image_url: "deleted", sort_order: 0, created_at: "2026-01-01", is_deleted: true },
    { id: "five", item_id: "another", image_url: "unrelated", sort_order: 0, created_at: "2026-01-01", is_deleted: false },
  ] });
  assert.deepEqual(plain(adminData([], ctx).items[0].images), ["main", "first", "second"]);
});

test("photo endpoint validates origin, item scope, file limits and stable upload IDs", async () => {
  const companyId = "22222222-2222-4222-a222-222222222222";
  const uploadId = "33333333-3333-4333-a333-333333333333";
  const calls = [];
  const route = loader({
    "next/cache": { revalidateTag() {}, revalidatePath() {} },
    "@/lib/admin/item-photo": { appendItemPhoto: async (...args) => { calls.push(args); return { id: uploadId, url: "https://example.test/photo.webp" }; } },
  })("app/api/admin/items/photos/route.ts");
  const request = (overrides = {}, origin = "http://localhost", file = new File(["photo"], "image.png", { type: "image/png" })) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ companyId, itemId: id, uploadId, ...overrides })) form.set(key, value);
    form.set("photo", file);
    return new Request("http://localhost/api/admin/items/photos", { method: "POST", headers: { Origin: origin }, body: form });
  };
  assert.equal((await route.POST(request({}, "https://elsewhere.test"))).status, 403);
  assert.equal((await route.POST(request({ uploadId: "invalid" }))).status, 400);
  assert.equal((await route.POST(request({}, "http://localhost", new File([Buffer.alloc(3 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await route.POST(request())).status, 201);
  assert.deepEqual(calls[0].slice(1), [companyId, id, uploadId]);
});

test("manual creation trims fields, supplies defaults and rejects client-owned IDs or invalid values", () => {
  const request = parseNewItemRequest({ companyId: " company ", values: { name: " 00123 ", group_id: "group", item_type: "Finished", print_name: " Blue & Gold " } });
  assert.equal(request.companyId, "company");
  const plan = planNewItem(request.values, context());
  assert.equal(plan.rows[0].status, "create");
  assert.equal(plan.rows[0].patch.name, "00123");
  assert.equal(plan.rows[0].patch.print_name, "Blue & Gold");
  assert.equal(plan.rows[0].patch.is_active, true);
  assert.equal(plan.rows[0].patch.show_on_website, false);
  assert.equal(plan.rows[0].patch.min_order_qty, 1);
  assert.equal(plan.rows[0].patch.allow_sales, true);
  for (const values of [{ id }, { company_id: "other" }, { updated_at: "today" }, { price: "100" }, { name: {} }, { group_id: "[clear]" }, { name: "x".repeat(2001) }]) {
    assert.throws(() => parseNewItemRequest({ companyId: "company", values }));
  }
  for (const body of [null, [], {}, { companyId: "company", values: [] }]) assert.throws(() => parseNewItemRequest(body));
});

test("manual creation rejects existing designs and codes instead of changing them", () => {
  for (const values of [{ name: "ac-507", print_name: "Overwrite" }, { name: "NEW", code: "it1" }]) {
    assert.throws(() => planNewItem(values, context()), error => error.status === 409);
  }
  assert.throws(() => planNewItem({ name: "NEW" }, context()), error => error.status === 400 && error.issues.some(issue => /Item Group/.test(issue)));
  assert.throws(() => planNewItem({ name: "NEW", group_id: "Missing", item_type: "Finished" }, context()), /Check the product/);
});

test("creation options exclude inactive, other-company, buying and non-template references", () => {
  const ctx = context([item(), item({ id: "template", has_variants: true })]);
  ctx.lookups.item_groups.push({ id: "disabled", name: "Disabled", company_id: "company", is_active: false }, { id: "other", name: "Other", company_id: "other" });
  ctx.lookups.price_lists = [{ id: "sell", name: "Selling", list_type: "Selling", company_id: "shared" }, { id: "buy", name: "Buying", list_type: "Buying", company_id: "company" }];
  const data = adminData([], ctx);
  assert.deepEqual(plain(data.referenceOptions.item_groups.map(option => option.id)), ["group"]);
  assert.deepEqual(plain(data.referenceOptions.items.map(option => option.id)), ["template"]);
  assert.deepEqual(plain(data.referenceOptions.price_lists), [{ id: "sell", name: "Selling", shared: true }]);
  assert.deepEqual(plain(data.itemTypes), ["Finished"]);
});

function createRequest(body, headers = {}) {
  return new Request("http://localhost/api/admin/items", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("create endpoint rejects cross-origin, malformed, oversized and unsupported payloads before reading data", async () => {
  let reads = 0;
  const route = loader({ "@/lib/admin/item-service": { loadItemContext() { reads++; throw new Error("Unexpected read"); } } })("app/api/admin/items/route.ts");
  for (const [request, status] of [
    [createRequest({}, { Origin: "https://elsewhere.test" }), 403],
    [createRequest({}, { Origin: "" }), 403],
    [createRequest({}, { "Content-Type": "text/plain" }), 415],
    [createRequest("{"), 400],
    [createRequest({ companyId: "company", values: { id } }), 400],
    [createRequest("x".repeat(256 * 1024 + 1)), 413],
  ]) assert.equal((await route.POST(request)).status, status);
  assert.equal(reads, 0);
});

test("create endpoint saves one product, invalidates caches and rejects replay without updating", async () => {
  const db = fakeDb();
  const invalidations = [];
  const route = loader({
    "next/cache": { revalidateTag(tag) { invalidations.push(tag); }, revalidatePath(path) { invalidations.push(path); } },
    "@/lib/admin/item-service": { loadItemContext: async companyId => { assert.equal(companyId, "company"); return { context: context(db.tables.items) }; }, commitItemPlan: plan => commitItemPlan(plan, db) },
  })("app/api/admin/items/route.ts");
  const payload = { companyId: "company", values: { name: "NEW", group_id: "group", item_type: "Finished", image_url: "https://example.test/card.jpg", show_on_website: "Y" } };
  const response = await route.POST(createRequest(payload));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).designNo, "NEW");
  assert.equal(db.tables.items.length, 2);
  assert.equal(db.tables.items[1].show_on_website, true);
  assert.equal(db.tables.items[1].company_id, "company");
  assert.deepEqual(invalidations, ["catalogue", "/"]);
  assert.equal((await route.POST(createRequest(payload))).status, 409);
  assert.equal(db.writes.length, 1);
  const invalid = await route.POST(createRequest({ ...payload, values: { ...payload.values, name: "BAD", min_order_qty: "0" } }));
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).issues.join(" "), /at least 1/);
});

test("create endpoint handles concurrent duplicates, write failures and cache failures accurately", async () => {
  for (const [result, expected] of [
    [{ created: 0, rows: [{ message: "This design was created after preview. Preview again." }] }, 409],
    [{ created: 0, rows: [{ message: "Database unavailable" }] }, 503],
    [{ created: 1, rows: [{ status: "created" }] }, 201],
  ]) {
    const route = loader({
      "next/cache": { revalidateTag() { throw new Error("Cache unavailable"); } },
      "@/lib/admin/item-service": { loadItemContext: async () => ({ context: context() }), commitItemPlan: async () => result },
    })("app/api/admin/items/route.ts");
    assert.equal((await route.POST(createRequest({ companyId: "company", values: { name: "NEW", group_id: "group", item_type: "Finished" } }))).status, expected);
  }
});

test("CSV preserves leading zeros, quoted commas/newlines and UTF-8 BOM", async () => {
  const file = await parseItemUpload(
    Buffer.from(
      '\uFEFFItem Name,Print Name,Item Description (Web),HSN / SAC\r\n00123,"Blue, gold","Line one\nLine two",04909\r\n',
    ),
    "items.csv",
  );
  assert.equal(file.rows[0].values.name, "00123");
  assert.equal(file.rows[0].values.print_name, "Blue, gold");
  assert.equal(file.rows[0].values.web_description, "Line one\nLine two");
  assert.equal(file.rows[0].values.hsn_sac, "04909");
});
test("parser rejects duplicate/unsupported populated headers and excessive rows, including after blank gaps", async () => {
  for (const file of [
    "Item Name,Design No\nA,A",
    "Item Name,Surprise\nA,secret",
    "Print Name\nA",
    "Item Name\n" + Array.from({ length: 1001 }, (_, i) => `A${i}`).join("\n"),
  ])
    await assert.rejects(parseItemUpload(Buffer.from(file), "x.csv"));
  const gap =
    "Item Name\n" +
    Array.from({ length: 1000 }, (_, i) => `A${i}`).join("\n") +
    "\n".repeat(100) +
    "EXTRA";
  await assert.rejects(parseItemUpload(Buffer.from(gap), "x.csv"), /1,000/);
  await assert.rejects(
    parseItemUpload(Buffer.alloc(4 * 1024 * 1024 + 1), "x.csv"),
    /4 MB/,
  );
});
test("XLSX reads Data, preserves dates/formatted identifiers, and rejects formula rows", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Lists").addRow(["ignore", "lookup"]);
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(["Item Name", "Offer Upto", "Print Name"]);
  sheet.addRow([123, new Date("2026-10-01T00:00:00Z"), "Title"]);
  sheet.getCell("A2").numFmt = "00000";
  sheet.addRow([
    "B",
    null,
    { formula: 'HYPERLINK("https://example.test","Click")', result: "Click" },
  ]);
  const data = await parseItemUpload(
    Buffer.from(await workbook.xlsx.writeBuffer()),
    "items.xlsx",
  );
  assert.equal(data.rows.length, 2);
  assert.equal(data.rows[0].values.name, "00123");
  assert.equal(data.rows[0].values.offer_upto, "2026-10-01");
  assert.match(data.rows[1].errors[0], /replace formulas/);
});
test("blank IDs match designs; only changed fields are patched and blank fields are preserved", () => {
  const plan = planItemImport(
    parsed({
      name: "ac-507",
      print_name: "New title",
      web_description: "",
      item_height: "0",
      show_on_website: "N",
    }),
    context([
      item({
        web_description: "Keep me",
        item_height: 12,
        show_on_website: true,
      }),
    ]),
    true,
  );
  assert.equal(plan.rows[0].status, "update");
  assert.deepEqual(plain(plan.rows[0].patch), {
    print_name: "New title",
    item_height: 0,
    show_on_website: false,
  });
  assert.equal(plan.rows[0].id, id);
  assert.equal(
    planItemImport(
      parsed({ name: "AC-507", print_name: "Old title" }),
      context(),
      true,
    ).rows[0].status,
    "unchanged",
  );
});
test("Item Category and Subject resolve separately, including shared-company references", () => {
  const plan = planItemImport(
    parsed({
      name: "AC-507",
      item_category_id: "Wedding Cards",
      subject_id: "Hindu Wedding Card",
    }),
    context(),
    true,
  );
  assert.deepEqual(plain(plan.rows[0].patch), {
    item_category_id: "category",
    subject_id: "subject",
  });
  assert.equal(plan.rows[0].changes[0].after, "Wedding Cards");
  assert.equal(plan.lookups.length, 0);
});
test("new references are explicit, deduplicated and scoped; new item IDs/codes are stable", () => {
  const plan = planItemImport(
    parsed(
      { name: "AC-507", item_category_id: "Wedding Card" },
      {
        name: "NEW",
        group_id: "Cards",
        item_type: "Finished",
        item_category_id: "Wedding Card",
      },
    ),
    context(),
    true,
  );
  assert.equal(plan.lookups.length, 1);
  assert.equal(plan.lookups[0].name, "Wedding Card");
  assert.equal(plan.rows[0].patch.subject_id, undefined);
  assert.equal(plan.rows[1].status, "create");
  assert.ok(plan.rows[1].patch.code.startsWith("WEB-"));
  assert.deepEqual(plain(plan.rows[1].patch.variant_attributes), {});
  assert.deepEqual(plain(plan.rows[1].patch.web_category_ids), []);
  assert.equal(plan.rows[1].id, importId("items", "company", "new"));
  assert.notEqual(plan.rows[1].id, importId("items", "another-company", "new"));
  assert.equal(
    planItemImport(
      parsed({ name: "AC-507", item_category_id: "Wedding Card" }),
      context(),
      false,
    ).rows[0].status,
    "invalid",
  );
});
test("conflicting IDs/codes and duplicate design numbers cannot be imported", () => {
  const plan = planItemImport(
    parsed(
      {
        name: "AC-590",
        id,
        code: "IT1",
        group_id: "Cards",
        item_type: "Finished",
      },
      { name: "AC-507" },
      { name: "ac-507" },
    ),
    context(),
    true,
  );
  assert.equal(plan.counts.invalid, 3);
  assert.match(plan.rows[0].errors.join(" "), /Record ID.*Code IT1/);
  assert.equal(plan.lookups.length, 0);
});
test("clears, Disable inversion, number/date validation and new-item requirements", () => {
  const plan = planItemImport(
    parsed({
      name: "AC-507",
      print_name: "[clear]",
      is_active: "Y",
      offer_upto: "30/09/2026",
    }),
    context(),
    true,
  );
  assert.deepEqual(plain(plan.rows[0].patch), {
    print_name: null,
    is_active: false,
    offer_upto: "2026-09-30",
  });
  assert.equal(
    plan.rows[0].changes.find((c) => c.field === "is_active").before,
    false,
  );
  for (const values of [
    { item_height: "NaN" },
    { offer_pct: "101" },
    { min_order_qty: "0" },
    { order_multiple: "1.5" },
    { offer_upto: "2026-02-30" },
    { show_on_website: "maybe" },
    { video_url: "javascript:alert(1)" },
  ])
    assert.equal(
      planItemImport(parsed({ name: "AC-507", ...values }), context(), true)
        .rows[0].status,
      "invalid",
    );
  assert.equal(
    planItemImport(parsed({ name: "NEW" }), context(), true).rows[0].status,
    "invalid",
  );
});
test("unrelated-company, ambiguous, purchasing-price-list and non-template references are rejected", () => {
  const ctx = context();
  ctx.lookups.brands = [{ id: "private", name: "Other", company_id: "other" }];
  ctx.lookups.price_lists = [
    { id: "buy", name: "Purchase", company_id: "company", list_type: "Buying" },
  ];
  ctx.lookups.uoms = [
    { id: "u1", name: "Pcs", company_id: "company" },
    { id: "u2", name: "Pcs", company_id: "company" },
  ];
  for (const value of [
    { brand_id: "private" },
    { website_price_list_id: "Purchase" },
    { primary_uom_id: "Pcs" },
    { variant_of: "AC-507" },
  ])
    assert.equal(
      planItemImport(parsed({ name: "AC-507", ...value }), ctx, false).rows[0]
        .status,
      "invalid",
    );
});
test("signed previews reject altered files, changed database snapshots, expiry and tampering", () => {
  const plan = planItemImport(
    parsed({ name: "AC-507", print_name: "New" }),
    context(),
    false,
  );
  const token = signPreview(plan, "file-hash", 1000);
  assert.doesNotThrow(() => verifyPreview(token, plan, "file-hash", 2000));
  assert.throws(
    () => verifyPreview(token, plan, "different-file", 2000),
    /changed/,
  );
  assert.throws(
    () => verifyPreview(token, plan, "file-hash", 2000000),
    /expired/,
  );
  assert.throws(
    () => verifyPreview(token + "x", plan, "file-hash", 2000),
    /Preview/,
  );
  const changed = plain(plan);
  changed.rows[0].expectedUpdatedAt = "new timestamp";
  assert.throws(
    () => verifyPreview(token, changed, "file-hash", 2000),
    /changed/,
  );
});

function fakeDb(seed = [item()]) {
  const tables = { items: plain(seed), item_categories: [] };
  const writes = [];
  const reads = [];
  const failures = {};
  const objects = new Map();
  return {
    tables,
    writes,
    reads,
    failures,
    objects,
    storage: { from() { return {
      async upload(path, bytes) {
        if (objects.has(path)) return { error: { statusCode: "409", message: "Already exists" } };
        objects.set(path, bytes);
        return { error: null };
      },
      getPublicUrl(path) { return { data: { publicUrl: `https://example.test/${path}` } }; },
    }; } },
    from(table) {
      let action = "select",
        patch,
        filters = [],
        returnRows = false,
        one = false,
        order,
        range,
        signal,
        columns,
        limit;
      const query = {
        range(from, to) { range = [from, to]; return query; },
        abortSignal(value) { signal = value; return query; },
        maybeSingle() { one = true; return query; },
        order(key, options = {}) { order = { key, ...options }; return query; },
        limit(count) { limit = count; return query; },
        or(expression) { assert.equal(expression, "image_url.is.null,image_url.eq."); filters.push(row => row.image_url == null || row.image_url === ""); return query; },
        select(value) {
          columns = value;
          returnRows = true;
          return query;
        },
        eq(k, v) {
          filters.push((row) => row[k] === v);
          return query;
        },
        ilike(k, v) {
          filters.push(
            (row) => String(row[k]).toLowerCase() === v.toLowerCase(),
          );
          return query;
        },
        insert(value) {
          action = "insert";
          patch = plain(value);
          return query;
        },
        update(value) {
          action = "update";
          patch = plain(value);
          return query;
        },
        upsert(value) {
          action = "upsert";
          patch = plain(value);
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              const rows = (tables[table] ||= []);
              let found = rows.filter((row) =>
                filters.every((filter) => filter(row)),
              );
              if (order) found.sort((a, b) => (Number(a[order.key] ?? 0) - Number(b[order.key] ?? 0)) * (order.ascending === false ? -1 : 1));
              if (limit) found = found.slice(0, limit);
              if (action === "select") {
                reads.push({ table, columns, signal, range });
                if (signal?.aborted) return { data: null, error: { message: "Request aborted" } };
                if (range) found = found.slice(range[0], range[1] + 1);
                if (columns && columns !== "*") found = found.map(row => Object.fromEntries(columns.split(",").map(key => [key, row[key]])));
                return { data: one ? (found[0] ?? null) : found, error: null };
              }
              if (failures[table]) { const error = failures[table]; delete failures[table]; return { error }; }
              writes.push({ table, action, patch });
              if (
                action === "insert" &&
                rows.some((row) => row.id === patch.id)
              )
                return { error: { code: "23505", message: "duplicate" } };
              if (action === "insert" || action === "upsert") {
                if (!rows.some((row) => row.id === patch.id)) rows.push(patch);
                return { data: null, error: null };
              }
              found.forEach((row) => Object.assign(row, patch));
              return { data: returnRows ? found : null, error: null };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
}
test("commit creates/updates, skips errors/unchanged and never duplicates on replay", async () => {
  const db = fakeDb([item(), item({ id: "id2", name: "KEEP", code: "IT2" })]);
  const plan = planItemImport(
    parsed(
      { name: "AC-507", print_name: "New" },
      {
        name: "NEW",
        group_id: "Cards",
        item_type: "Finished",
        item_category_id: "New Category",
      },
      { name: "KEEP" },
      { name: "BAD", offer_pct: "999" },
    ),
    context(db.tables.items),
    true,
  );
  const result = await commitItemPlan(plan, db);
  assert.deepEqual(
    [
      result.updated,
      result.created,
      result.unchanged,
      result.skipped,
      result.failed,
    ],
    [1, 1, 1, 1, 0],
  );
  assert.equal(db.tables.items[0].print_name, "New");
  assert.equal(db.tables.item_categories.length, 1);
  const replay = await commitItemPlan(plan, db);
  assert.equal(replay.failed, 2);
  assert.equal(db.tables.items.length, 3);
  assert.equal(db.tables.item_categories.length, 1);
});
test("concurrent item changes fail instead of overwriting newer data", async () => {
  const plan = planItemImport(
    parsed({ name: "AC-507", print_name: "Uploaded" }),
    context(),
    true,
  );
  const db = fakeDb([
    item({
      print_name: "Edited elsewhere",
      updated_at: "2026-09-20T00:00:00Z",
    }),
  ]);
  const result = await commitItemPlan(plan, db);
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 0);
  assert.equal(db.tables.items[0].print_name, "Edited elsewhere");
});
test("reimporting updated units is unchanged, including the stored unit name", async () => {
  const db = fakeDb([item({ primary_uom_id: "unit", stock_uom: "Old unit" })]);
  const ctx = context(db.tables.items);
  ctx.lookups.uoms = [
    { id: "unit", name: "Pcs", company_id: "company", is_active: true },
  ];
  const input = parsed({ name: "AC-507", primary_uom_id: "Pcs" });
  const plan = planItemImport(input, ctx, true);
  assert.equal(plan.rows[0].changes[0].label, "Primary UOM (stored name)");
  assert.equal((await commitItemPlan(plan, db)).updated, 1);
  assert.equal(planItemImport(input, ctx, true).rows[0].status, "unchanged");
});
test("dashboard keeps Item Name/Print Name separate and resolves category names", () => {
  const data = adminData(
    [],
    context([
      item({
        item_category_id: "category",
        show_on_website: true,
        description: "Description",
      }),
    ]),
  );
  assert.equal(data.items[0].designNo, "AC-507");
  assert.equal(data.items[0].printName, "Old title");
  assert.equal(data.items[0].category, "Wedding Cards");
  assert.equal(data.items[0].fields.Disable, false);
});
test("route rejects cross-origin writes and malformed requests before database access", async () => {
  let reads = 0;
  const route = loader({
    "next/server": { NextResponse },
    "next/cache": { revalidatePath() {} },
    "@/lib/admin/item-service": {
      loadItemContext() {
        reads++;
        throw new Error("Should not read");
      },
    },
  })("app/api/admin/items/import/route.ts");
  const request = (origin, body) =>
    new Request("http://localhost/api/admin/items/import", {
      method: "POST",
      headers: origin ? { Origin: origin } : {},
      body,
    });
  assert.equal(
    (await route.POST(request("https://elsewhere.test", new FormData())))
      .status,
    403,
  );
  assert.equal(
    (await route.POST(request(undefined, new FormData()))).status,
    403,
  );
  assert.equal(
    (await route.POST(request("http://localhost", new FormData()))).status,
    400,
  );
  assert.equal(reads, 0);
});
