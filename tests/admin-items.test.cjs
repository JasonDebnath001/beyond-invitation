const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const ExcelJS = require("exceljs");
const { NextResponse } = require("next/server");

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
  return {
    tables,
    writes,
    from(table) {
      let action = "select",
        patch,
        filters = [],
        returnRows = false;
      const query = {
        select() {
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
              const found = rows.filter((row) =>
                filters.every((filter) => filter(row)),
              );
              if (action === "select") return { data: found, error: null };
              writes.push({ table, action, patch });
              if (
                action === "insert" &&
                rows.some((row) => row.id === patch.id)
              )
                return { error: { message: "duplicate" } };
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
