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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      Buffer,
      URL,
      File,
      FormData,
      console,
      AbortController,
      ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === "server-only") return {};
        if (name === "@/lib/supabase/admin")
          return {
            getSupabaseAdminClient() {
              throw new Error("No live database in tests");
            },
          };
        if (name.startsWith("./"))
          return load(
            path.relative(
              path.resolve(__dirname, ".."),
              path.resolve(path.dirname(filename), `${name}.${fs.existsSync(path.resolve(path.dirname(filename), `${name}.ts`)) ? "ts" : "tsx"}`),
            ),
          );
        if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
        return require(name);
      },
    });
    return exports;
  }
  return load;
}

const { replaceItemPhoto, itemPhotoStoragePath } = loader()(
  "lib/admin/item-photo.ts",
);
const companyId = "11111111-1111-4111-a111-111111111111";
const itemId = "22222222-2222-4222-a222-222222222222";
const uploadId = "33333333-3333-4333-a333-333333333333";
const base =
  "https://project.supabase.co/storage/v1/object/public/item_images/";
const oldUrl = `${base}legacy/Card%20front_1.png`;
const thumbUrl = `${base}legacy/thumb.png`;
const galleryThumb = `${base}legacy/gallery-thumb.png`;
const newPath = `dashboard/${companyId}/${itemId}/${uploadId}_1.webp`;
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture({ mainOnly = false, galleryOnly = false } = {}) {
  const tables = {
    companies: [{ id: companyId, is_active: true }],
    items: [
      {
        id: itemId,
        company_id: companyId,
        image_url: galleryOnly ? `${base}main.png` : oldUrl,
        thumb_url: thumbUrl,
      },
    ],
    item_images: mainOnly
      ? []
      : [
          {
            id: "original",
            company_id: companyId,
            item_id: itemId,
            image_url: oldUrl,
            thumb_url: galleryThumb,
            sort_order: 5,
            is_deleted: false,
          },
        ],
  };
  const objects = new Map(
    [
      "legacy/Card front_1.png",
      "legacy/thumb.png",
      "legacy/gallery-thumb.png",
    ].map((key) => [key, Buffer.from("old")]),
  );
  const operations = [];
  const db = {
    tables,
    objects,
    operations,
    fail: null,
    before: null,
    storage: {
      from(bucket) {
        assert.equal(bucket, "item_images");
        return {
          getPublicUrl: (key) => ({ data: { publicUrl: base + key } }),
          async upload(key, bytes) {
            operations.push({ action: "upload", key });
            if (db.fail === "upload") {
              db.fail = null;
              return { error: { message: "Upload failed" } };
            }
            if (objects.has(key))
              return {
                error: { statusCode: "409", message: "Already exists" },
              };
            objects.set(key, bytes);
            return { error: null };
          },
          async remove(keys) {
            operations.push({ action: "remove", keys: [...keys] });
            // No referenced original may be removed before its database update.
            assert.ok(!tables.items.some((row) => row.image_url === oldUrl));
            assert.ok(
              !tables.item_images.some(
                (row) => !row.is_deleted && row.image_url === oldUrl,
              ),
            );
            if (db.fail === "remove") {
              db.fail = null;
              return { error: { message: "Storage unavailable" } };
            }
            keys.forEach((key) => objects.delete(key));
            return { error: null };
          },
        };
      },
    },
    from(table) {
      let action = "select",
        patch,
        one = false,
        limit,
        columns;
      const filters = [];
      const query = {
        select(value) {
          columns = value;
          return query;
        },
        eq(key, value) {
          filters.push((row) => row[key] === value);
          return query;
        },
        in(key, values) {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        maybeSingle() {
          one = true;
          return query;
        },
        limit(value) {
          limit = value;
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
        delete() {
          action = "delete";
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              db.before?.({ table, action, patch });
              operations.push({ table, action });
              if (db.fail === `${table}:${action}`) {
                db.fail = null;
                return {
                  data: null,
                  error: { message: "Database unavailable" },
                };
              }
              let rows = tables[table].filter((row) =>
                filters.every((filter) => filter(row)),
              );
              if (limit) rows = rows.slice(0, limit);
              if (action === "upsert") {
                for (const row of patch)
                  if (!tables[table].some((existing) => existing.id === row.id))
                    tables[table].push(row);
              } else if (action === "update")
                rows.forEach((row) => Object.assign(row, patch));
              else if (action === "delete")
                tables[table] = tables[table].filter(
                  (row) => !rows.includes(row),
                );
              const data = plain(
                rows.map((row) =>
                  columns
                    ? Object.fromEntries(
                        columns.split(",").map((key) => [key, row[key]]),
                      )
                    : row,
                ),
              );
              return { data: one ? (data[0] ?? null) : data, error: null };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
  return db;
}

async function photo() {
  const bytes = await require("sharp")({
    create: { width: 4, height: 4, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  return new File([bytes], "replacement.png", { type: "image/png" });
}
const replace = async (db, previous = oldUrl, id = uploadId) =>
  replaceItemPhoto(await photo(), companyId, itemId, id, previous, db);

test("replacing the main photo updates duplicates and thumbnails, preserves order, and deletes original storage objects", async () => {
  const db = fixture();
  const result = await replace(db);
  assert.equal(result.url, base + newPath);
  assert.equal(db.tables.items[0].image_url, result.url);
  assert.equal(db.tables.items[0].thumb_url, result.url);
  assert.equal(db.tables.item_images.length, 1);
  assert.equal(db.tables.item_images[0].id, "original");
  assert.equal(db.tables.item_images[0].sort_order, 5);
  assert.equal(db.tables.item_images[0].image_url, result.url);
  assert.equal(db.tables.item_images[0].thumb_url, result.url);
  assert.deepEqual([...db.objects.keys()], [newPath]);
  const writes = db.operations.length;
  assert.deepEqual(plain(await replace(db)), plain(result));
  assert.ok(
    db.operations.slice(writes).every((op) => op.action === "select"),
    "lost success response does not upload or delete again",
  );
});

test("a main photo without a gallery record can be replaced and cleaned up", async () => {
  const db = fixture({ mainOnly: true });
  const result = await replace(db);
  assert.equal(db.tables.items[0].image_url, result.url);
  assert.equal(db.tables.item_images.length, 0);
  assert.ok(!db.objects.has("legacy/Card front_1.png"));
  assert.ok(!db.objects.has("legacy/thumb.png"));
});

test("gallery replacement preserves the main photo and updates an item thumbnail pointing at that gallery photo", async () => {
  const db = fixture({ galleryOnly: true });
  db.tables.items[0].thumb_url = oldUrl;
  const result = await replace(db);
  assert.equal(db.tables.items[0].image_url, base + "main.png");
  assert.equal(db.tables.items[0].thumb_url, result.url);
  assert.equal(db.tables.item_images[0].image_url, result.url);
  assert.ok(!db.objects.has("legacy/Card front_1.png"));
});

for (const failure of [
  "upload",
  "item_images:upsert",
  "items:update",
  "item_images:update",
  "remove",
  "item_images:delete",
]) {
  test(`replacement retries ${failure} failures without losing originals early or duplicating gallery entries`, async () => {
    const db = fixture();
    db.fail = failure;
    await assert.rejects(replace(db));
    if (failure !== "item_images:delete")
      assert.ok(db.objects.has("legacy/Card front_1.png"));
    if (["upload", "item_images:upsert", "items:update"].includes(failure))
      assert.equal(db.tables.items[0].image_url, oldUrl);
    const result = await replace(db);
    assert.equal(db.tables.item_images.length, 1);
    assert.equal(db.tables.item_images[0].image_url, result.url);
    assert.deepEqual([...db.objects.keys()], [newPath]);
  });
}

test("invalid files, wrong companies, stale targets and another item's upload ID cannot delete storage", async () => {
  const db = fixture();
  await assert.rejects(
    replaceItemPhoto(
      new File(["bad"], "bad.png", { type: "image/png" }),
      companyId,
      itemId,
      uploadId,
      oldUrl,
      db,
    ),
  );
  await assert.rejects(
    replaceItemPhoto(await photo(), "other", itemId, uploadId, oldUrl, db),
    (error) => error.status === 404,
  );
  await assert.rejects(
    replace(db, base + "not-this-item.png"),
    (error) => error.status === 409,
  );
  db.tables.item_images.push({
    id: uploadId,
    company_id: companyId,
    item_id: "other",
    image_url: oldUrl,
    is_deleted: true,
  });
  await assert.rejects(replace(db), (error) => error.status === 409);
  assert.ok(
    !db.operations.some(
      (op) => op.action === "remove" || op.action === "upload",
    ),
  );
});

test("old thumbnails shared by another item are retained", async () => {
  const db = fixture();
  db.tables.items.push({
    id: "other",
    company_id: "other-company",
    image_url: thumbUrl,
  });
  await replace(db);
  assert.ok(db.objects.has("legacy/thumb.png"));
  assert.ok(!db.objects.has("legacy/Card front_1.png"));
  assert.ok(!db.objects.has("legacy/gallery-thumb.png"));
});

test("concurrent main-photo changes are not overwritten and do not trigger original deletion", async () => {
  const db = fixture();
  db.before = ({ table, action }) => {
    if (table === "items" && action === "update") {
      db.before = null;
      db.tables.items[0].image_url = base + "concurrent.png";
    }
  };
  await assert.rejects(replace(db), (error) => error.status === 409);
  assert.equal(db.tables.items[0].image_url, base + "concurrent.png");
  assert.ok(db.objects.has("legacy/Card front_1.png"));
  assert.ok(!db.operations.some((op) => op.action === "remove"));
});

test("cleanup resolves encoded public/signed/render URLs and rejects other projects, buckets and invalid paths", () => {
  assert.equal(
    itemPhotoStoragePath(oldUrl, base + "probe"),
    "legacy/Card front_1.png",
  );
  assert.equal(
    itemPhotoStoragePath(
      oldUrl.replace("object/public", "object/sign") + "?token=x",
      base + "probe",
    ),
    "legacy/Card front_1.png",
  );
  assert.equal(
    itemPhotoStoragePath(
      oldUrl.replace("object/public", "render/image/public") + "?width=100",
      base + "probe",
    ),
    "legacy/Card front_1.png",
  );
  for (const url of [
    oldUrl.replace("project.supabase.co", "other.supabase.co"),
    oldUrl.replace("item_images/", "blog_images/"),
    base + "%2e%2e%2fsecret.png",
    "invalid",
  ]) {
    assert.equal(itemPhotoStoragePath(url, base + "probe"), undefined);
  }
});

test("photo endpoint routes replacements, validates targets and invalidates cached partial saves", async () => {
  const calls = [],
    invalidations = [];
  const route = loader({
    "next/cache": {
      revalidateTag: (value) => invalidations.push(value),
      revalidatePath() {},
    },
    "@/lib/admin/item-photo": {
      appendItemPhoto: async (...args) => {
        calls.push({ action: "append", args });
        return { id: uploadId };
      },
      replaceItemPhoto: async (...args) => {
        calls.push({ action: "replace", args });
        throw new Error("Cleanup needs retry");
      },
    },
  })("app/api/admin/items/photos/route.ts");
  const request = (replacement, origin = "http://localhost") => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ companyId, itemId, uploadId }))
      form.set(key, value);
    form.set("photo", new File(["photo"], "photo.png", { type: "image/png" }));
    if (replacement !== undefined) form.set("replaceUrl", replacement);
    return new Request("http://localhost/api/admin/items/photos", {
      method: "POST",
      headers: { Origin: origin },
      body: form,
    });
  };
  assert.equal(
    (await route.POST(request(oldUrl, "https://other.test"))).status,
    403,
  );
  assert.equal((await route.POST(request(""))).status, 400);
  assert.equal((await route.POST(request("x".repeat(2001)))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await route.POST(request(oldUrl))).status, 503);
  assert.equal(calls[0].action, "replace");
  assert.equal(calls[0].args[4], oldUrl);
  assert.equal(invalidations.length, 1);
  assert.equal((await route.POST(request())).status, 201);
  assert.equal(calls[1].action, "append");
});

async function withEditor(run) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost/admin" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const calls = [], saved = [];
  let respond = async () => ({ ok: true, json: async () => ({ id: itemId, designNo: "CARD-1" }) });
  const Editor = loader({
    "./ItemDashboard.module.css": {},
    "./ProductPhoto": ({ src, alt }) => src ? React.createElement("img", { src, alt }) : null,
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/lib/admin/item-photo-client": { prepareProductPhoto: async file => file },
  }, {
    FormData: dom.window.FormData,
    crypto: require("node:crypto").webcrypto,
    URL: { createObjectURL: () => "blob:preview", revokeObjectURL() {} },
    fetch: async (url, init) => {
      const body = init.body instanceof dom.window.FormData ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body);
      const call = { url, method: init.method, body };
      calls.push(call);
      return respond(call);
    },
  })("components/admin/ProductEditorDialog.tsx").default;
  const item = {
    id: itemId, designNo: "CARD-1", updatedAt: "2026-09-23T00:00:00Z", fields: {},
    values: { name: "CARD-1", image_url: oldUrl, thumb_url: thumbUrl },
    images: [oldUrl, base + "gallery_2.png"],
  };
  const root = createRoot(document.getElementById("root"));
  const data = { companyId, companies: [{ id: companyId, name: "Company" }], referenceOptions: {}, itemTypes: [], items: [item] };
  const click = selector => React.act(async () => document.querySelector(selector).click());
  const choose = async (index, name = "replacement.png") => {
    await click(`[aria-label="Replace photo ${index}"]`);
    await React.act(async () => {
      const input = document.querySelector('[aria-label="Choose replacement photo"]');
      Object.defineProperty(input, "files", { configurable: true, value: [new dom.window.File(["photo"], name, { type: "image/png" })] });
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  const submit = () => React.act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  try {
    await React.act(async () => root.render(React.createElement(Editor, { data, item, onClose() {}, onSaved: product => saved.push(product) })));
    await run({ calls, saved, choose, click, submit, respond: fn => { respond = fn; } });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("editor queues main-photo replacement until save, locks conflicting links, and allows cancellation", async () => withEditor(async ({ choose, click, calls }) => {
  await choose(1);
  assert.equal(calls.length, 0);
  assert.equal(document.querySelector('[name="image_url"]').disabled, true);
  assert.equal(document.querySelector('[name="thumb_url"]').disabled, true);
  assert.equal(document.querySelector('[aria-label="Replace photo 1"]').disabled, true);
  assert.match(document.querySelector('[aria-label="Selected photos"]').textContent, /Ready to replace photo/);
  await click('[aria-label="Remove replacement.png"]');
  assert.equal(document.querySelector('[name="image_url"]').disabled, false);
  assert.equal(document.querySelector('[aria-label="Replace photo 1"]').disabled, false);
  assert.equal(document.querySelector('[aria-label="Selected photos"]'), null);
  assert.equal(calls.length, 0);
}));

test("editor sends the selected original URL and saves replacement only after item details", async () => withEditor(async ({ choose, calls, saved, submit }) => {
  await choose(1);
  await submit();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(calls[0].body.values, {});
  assert.equal(calls[1].url, "/api/admin/items/photos");
  assert.equal(calls[1].body.replaceUrl, oldUrl);
  assert.equal(calls[1].body.itemId, itemId);
  assert.equal(calls[1].body.companyId, companyId);
  assert.equal(saved.length, 1);
  assert.match(document.querySelector('[aria-label="Selected photos"]').textContent, /Photo replaced/);
  assert.ok(![...document.querySelectorAll('[aria-label="Existing product photos"] img')].some(img => img.src === oldUrl));
}));

test("editor retries failed replacement cleanup with the same ID, keeps successful photos, and prevents abandoning cleanup", async () => withEditor(async ({ choose, calls, saved, submit, respond }) => {
  await choose(1, "front.png");
  await choose(2, "back.png");
  respond(async call => call.body.photo?.name === "back.png"
    ? { ok: false, json: async () => ({ error: "Replacement saved, but old photos could not be deleted. Retry to finish." }) }
    : { ok: true, json: async () => ({ id: itemId, designNo: "CARD-1" }) });
  await submit();
  assert.equal(saved.length, 0);
  assert.match(document.querySelector('[role="alert"]').textContent, /1 of 2/);
  assert.equal(document.querySelector('[aria-label="Remove back.png"]'), null);
  assert.equal(document.querySelector('[type="submit"]').textContent, "Retry remaining photos");
  respond(async () => ({ ok: true, json: async () => ({ id: itemId }) }));
  await submit();
  assert.equal(saved.length, 1);
  assert.deepEqual(calls.map(call => call.method), ["PATCH", "POST", "POST", "POST"]);
  assert.equal(calls[2].body.uploadId, calls[3].body.uploadId);
  assert.equal(calls[3].body.replaceUrl, base + "gallery_2.png");
}));
