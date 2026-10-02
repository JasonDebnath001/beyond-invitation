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

function descriptionDb(descriptions, error = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, "item_descriptions");
      const call = { orders: [] };
      calls.push(call);
      return {
        select() { return this; },
        in(key, ids) { assert.equal(key, "item_id"); call.ids = [...ids]; return this; },
        order(key, options) { call.orders.push([key, options]); return this; },
        range(from, to) { call.range = [from, to]; return this; },
        async returns() {
          const rows = descriptions.filter((row) => call.ids.includes(row.item_id));
          rows.sort((a, b) => {
            for (const [key, options] of call.orders) {
              const av = a[key], bv = b[key];
              if (av === bv) continue;
              if (av == null) return options.nullsFirst ? -1 : 1;
              if (bv == null) return options.nullsFirst ? 1 : -1;
              return (av < bv ? -1 : 1) * (options.ascending ? 1 : -1);
            }
            return 0;
          });
          return { data: error ? null : rows.slice(call.range[0], call.range[1] + 1), error };
        },
      };
    },
  };
}

test("catalogue uses the first nonblank description title in row order, otherwise the print name", async () => {
  const rows = [
    { id: "card", name: "414040", description: "Original description", slug: "414040" },
    { id: "blank", name: "Print name" },
    { id: "missing", name: "Another print name" },
  ];
  const db = descriptionDb([
    { id: "a", item_id: "card", line_no: 10, title: "Later title" },
    { id: "b", item_id: "card", line_no: 1, title: " \n " },
    { id: "z", item_id: "card", line_no: 2, title: "  Ivory White & Gold  " },
    { id: "c", item_id: "card", line_no: null, title: "Unordered title" },
    { id: "d", item_id: "blank", line_no: 1, title: null },
    { id: "e", item_id: "blank", line_no: 2, title: "" },
    { id: "f", item_id: "blank", line_no: 3, title: "\t " },
    { id: "private", item_id: "not-in-catalogue", line_no: 1, title: "Private title" },
  ]);
  const result = await applyCatalogTitles(rows, db);
  assert.deepEqual(plain(result), [
    { ...rows[0], name: "Ivory White & Gold" }, rows[1], rows[2],
  ]);
  assert.equal(rows[0].name, "414040");
  assert.deepEqual(db.calls[0].ids, ["card", "blank", "missing"]);
});

test("catalogue titles page description rows and batch item IDs without losing later titles", async () => {
  const rows = Array.from({ length: 201 }, (_, i) => ({ id: `item-${i}`, name: `Print ${i}` }));
  const descriptions = Array.from({ length: 1000 }, (_, i) => ({
    id: `blank-${i}`, item_id: "item-0", line_no: i + 1, title: " ",
  }));
  descriptions.push(
    { id: "title", item_id: "item-0", line_no: 1001, title: "First product title" },
    { id: "last", item_id: "item-200", line_no: 1, title: "Last product title" },
  );
  const db = descriptionDb(descriptions);
  const result = await applyCatalogTitles(rows, db);
  assert.equal(result.length, 201);
  assert.equal(result[0].name, "First product title");
  assert.equal(result[199].name, "Print 199");
  assert.equal(result[200].name, "Last product title");
  assert.deepEqual(db.calls.map((call) => [call.ids.length, call.range[0]]), [[200, 0], [200, 1000], [1, 0]]);
});

test("empty catalogues need no title query, and database failures are not mistaken for absent titles", async () => {
  assert.deepEqual(plain(await applyCatalogTitles([])), []);
  await assert.rejects(
    () => applyCatalogTitles([{ id: "card", name: "Print name" }], descriptionDb([], { message: "offline" })),
    /Product titles unavailable: offline/,
  );
});
