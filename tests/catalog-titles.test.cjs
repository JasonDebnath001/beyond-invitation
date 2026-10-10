const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const exported = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, "../lib/catalog-titles.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, {
  exports: exported,
  require(name) {
    if (name === "server-only") return {};
    assert.equal(name, "@/lib/supabase/admin");
    return { getSupabaseAdminClient() { throw new Error("No live database in tests"); } };
  },
});
const { applyCatalogTitles } = exported;
const plain = (value) => JSON.parse(JSON.stringify(value));

function titleDb(items, error = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, "items");
      const call = {};
      calls.push(call);
      return {
        select(columns) { assert.equal(columns, "id,web_title"); return this; },
        in(key, ids) { assert.equal(key, "id"); call.ids = [...ids]; return this; },
        async returns() {
          const rows = items.filter((row) => call.ids.includes(row.id));
          return { data: error ? null : rows, error };
        },
      };
    },
  };
}

test("catalogue prefers trimmed Web Title and preserves other product data and blank-title fallbacks", async () => {
  const rows = [
    { id: "card", name: "414040", description: "Original description", slug: "414040" },
    { id: "blank", name: "Print name" },
    { id: "null", name: "Null title print name" },
    { id: "empty", name: "Empty title print name" },
    { id: "missing", name: "Another print name" },
  ];
  const db = titleDb([
    { id: "card", web_title: "  Ivory White & Gold  ", print_name: "Old print name", title: "Old description title" },
    { id: "blank", web_title: " \n\t " },
    { id: "null", web_title: null },
    { id: "empty", web_title: "" },
    { id: "not-in-catalogue", web_title: "Private title" },
  ]);
  const result = await applyCatalogTitles(rows, db);
  assert.deepEqual(plain(result), [
    { ...rows[0], name: "Ivory White & Gold" }, ...rows.slice(1),
  ]);
  assert.equal(rows[0].name, "414040");
  assert.deepEqual(db.calls[0].ids, ["card", "blank", "null", "empty", "missing"]);
});

test("catalogue Web Titles batch published item IDs without losing or reordering products", async () => {
  const rows = Array.from({ length: 401 }, (_, i) => ({ id: `item-${i}`, name: `Print ${i}` }));
  const db = titleDb(rows.map(({ id }, i) => ({ id, web_title: `Web Title ${i}` })).reverse());
  const result = await applyCatalogTitles(rows, db);
  assert.deepEqual(plain(result), rows.map((row, i) => ({ ...row, name: `Web Title ${i}` })));
  assert.deepEqual(db.calls.map((call) => call.ids.length), [200, 200, 1]);
  assert.deepEqual(db.calls.flatMap((call) => call.ids), rows.map(({ id }) => id));
});

test("empty catalogues need no title query, and database failures are not mistaken for absent titles", async () => {
  assert.deepEqual(plain(await applyCatalogTitles([])), []);
  await assert.rejects(
    () => applyCatalogTitles([{ id: "card", name: "Print name" }], titleDb([], { message: "offline" })),
    /Product titles unavailable: offline/,
  );
});
