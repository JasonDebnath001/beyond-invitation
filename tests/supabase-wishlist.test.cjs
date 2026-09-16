const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { NextResponse } = require("next/server");

function load(file, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { error() {} },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    }, ...globals,
  });
  return exports;
}
const wishlist = load("lib/wishlist.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const request = (method, body, headers = {}) => new Request("https://shop.test/api/wishlist", {
  method, headers: { "Content-Type": "application/json", ...headers },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

function fixture() {
  const state = { user: { id: "alice" }, authError: null, dbError: null, reads: 0, writes: [],
    rows: [{ user_id: "alice", product_slug: "saved" }, { user_id: "bob", product_slug: "private" }],
    products: ["saved", "new", "guest", "private"] };
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.authError }) },
    from(table) {
      state.reads++;
      const filters = [];
      let operation = "select", input, options;
      const query = {
        select() { return query; }, order() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        in(key, value) { filters.push([key, value]); return query; },
        delete() { operation = "delete"; return query; },
        upsert(rows, opts) { operation = "insert"; input = rows; options = opts; return query; },
        then(resolve, reject) {
          if (state.dbError) return Promise.resolve({ data: null, error: state.dbError }).then(resolve, reject);
          const matches = (row) => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
          if (operation === "insert") {
            state.writes.push({ input: plain(input), options: plain(options) });
            for (const row of input) if (!state.rows.some((existing) => existing.user_id === row.user_id && existing.product_slug === row.product_slug)) state.rows.push(row);
          }
          if (operation === "delete") state.rows = state.rows.filter((row) => !matches(row));
          const rows = table === "v_web_products" ? state.products.map((slug) => ({ slug })) : state.rows;
          return Promise.resolve({ data: rows.filter(matches), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const route = load("app/api/wishlist/route.ts", {
    "next/server": { NextResponse }, "@/lib/wishlist": wishlist,
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => client },
  }, { URL });
  return { state, route };
}

test("wishlist API rejects unauthenticated requests before touching the database", async () => {
  const { state, route } = fixture();
  state.user = null;
  for (const method of ["GET", "POST", "DELETE"]) {
    const result = await route[method](request(method, method === "GET" ? undefined : { slug: "new" }));
    assert.equal(result.status, 401);
    assert.match(result.headers.get("cache-control"), /private, no-store/);
  }
  assert.equal(state.reads, 0);
});

test("wishlist API isolates owners and ignores forged user IDs", async () => {
  const { state, route } = fixture();
  assert.deepEqual(await (await route.GET(request("GET"))).json(), { userId: "alice", slugs: ["saved"] });
  const result = await route.POST(request("POST", { slug: "new", user_id: "bob" }));
  assert.equal(result.status, 200);
  assert.deepEqual(state.writes[0].input, [{ user_id: "alice", product_slug: "new" }]);
  assert.deepEqual(state.writes[0].options, { onConflict: "user_id,product_slug", ignoreDuplicates: true });
  assert.equal((await route.DELETE(request("DELETE", { slug: "private", user_id: "bob" }))).status, 200);
  assert.ok(state.rows.some((row) => row.user_id === "bob" && row.product_slug === "private"));
});

test("wishlist rejects stale account requests, cross-origin writes and non-JSON forms", async () => {
  const { state, route } = fixture();
  assert.equal((await route.POST(request("POST", { slug: "new" }, { "x-wishlist-user": "bob" }))).status, 409);
  assert.equal((await route.POST(request("POST", { slug: "new" }, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await route.POST(request("POST", { slug: "new" }, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal(state.reads, 0);
});

test("wishlist validates inputs, deduplicates merges, and only adds published products", async () => {
  const { state, route } = fixture();
  for (const body of [null, {}, { slug: 123 }, { slug: " " }, { slug: "x".repeat(201) }, { slugs: [null] }, { slugs: Array(501).fill("new") }]) {
    assert.equal((await route.POST(request("POST", body))).status, 400);
  }
  assert.equal(state.reads, 0);
  assert.equal((await route.POST(request("POST", { slug: "missing" }))).status, 404);
  const response = await route.POST(request("POST", { slugs: [" guest ", "guest", "saved", "missing"] }));
  assert.deepEqual(await response.json(), { userId: "alice", slugs: ["saved", "guest"], unmergedSlugs: [] });
  await route.POST(request("POST", { slug: "guest" }));
  assert.equal(state.rows.filter((row) => row.product_slug === "guest").length, 1);
  // A product becoming unavailable does not prevent removal or an idempotent re-add.
  state.products = [];
  assert.equal((await route.POST(request("POST", { slug: "guest" }))).status, 200);
  await route.DELETE(request("DELETE", { slug: "guest" }));
  assert.ok(!state.rows.some((row) => row.product_slug === "guest"));
});

test("wishlist preserves guest overflow and rejects single additions at capacity", async () => {
  const { state, route } = fixture();
  state.rows = Array.from({ length: 499 }, (_, i) => ({ user_id: "alice", product_slug: `saved-${i}` }));
  const result = await (await route.POST(request("POST", { slugs: ["guest", "new"] }))).json();
  assert.equal(result.slugs.length, 500);
  assert.deepEqual(result.unmergedSlugs, ["new"]);
  assert.equal((await route.POST(request("POST", { slug: "new" }))).status, 409);
});

test("wishlist database failures are errors without exposing internal details", async () => {
  const { state, route } = fixture();
  state.dbError = { code: "42P01", message: "private database detail" };
  const result = await route.GET(request("GET"));
  assert.equal(result.status, 503);
  assert.ok(!(await result.text()).includes("private database detail"));
  state.dbError = { code: "P0001" };
  assert.equal((await route.POST(request("POST", { slug: "new" }))).status, 409);
});

test("account wishlists merge guests, rollback failed writes, refresh across tabs and clear on sign-out", async () => {
  const { JSDOM } = require("jsdom");
  const React = require("react");
  const { act } = React;
  const dom = new JSDOM('<div id="root"></div>', { url: "https://shop.test" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require("react-dom/client");
  const auth = { user: { id: "alice" }, ready: true };
  let latest, failWrite = false, pendingRead, failRead = false;
  const saved = { alice: ["saved"], bob: ["private"] };
  const fetch = async (_url, init) => {
    const owner = init.headers["x-wishlist-user"];
    const body = init.body ? JSON.parse(init.body) : {};
    if (init.method === "GET" && pendingRead) return pendingRead;
    if ((init.method !== "GET" && failWrite) || (init.method === "GET" && failRead)) return Response.json({ error: "Connection failed" }, { status: 503 });
    if (init.method === "POST") saved[owner] = [...new Set([...saved[owner], ...(body.slugs || [body.slug])])];
    if (init.method === "DELETE") saved[owner] = saved[owner].filter((slug) => slug !== body.slug);
    return Response.json({ userId: owner, slugs: saved[owner], unmergedSlugs: [] });
  };
  const provider = load("components/WishlistProvider.tsx", {
    react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/wishlist": wishlist,
    "./AuthProvider": { useAuth: () => auth },
  }, { fetch, AbortController, window: dom.window, localStorage: dom.window.localStorage });
  const Probe = () => { latest = provider.useWishlist(); return React.createElement("p", null, latest.slugs.join(",")); };
  const root = createRoot(document.getElementById("root"));
  const render = async () => act(async () => root.render(React.createElement(provider.WishlistProvider, null, React.createElement(Probe))));
  try {
    dom.window.localStorage.setItem(wishlist.WISHLIST_STORAGE_KEY, '["guest","saved"]');
    await render();
    assert.deepEqual(plain(latest.slugs), ["saved", "guest"]);
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), "[]");
    assert.ok(latest.ready && !latest.syncing);

    failWrite = true;
    await act(async () => latest.toggleItem("new"));
    assert.deepEqual(plain(latest.slugs), ["saved", "guest"]);
    assert.match(document.querySelector('[role="alert"]').textContent, /Connection failed/);
    failWrite = false;
    await act(async () => latest.toggleItem("new"));
    assert.deepEqual(saved.alice, ["saved", "guest", "new"]);
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), "[]");
    await act(async () => latest.removeItem("new"));
    assert.deepEqual(saved.alice, ["saved", "guest"]);

    saved.alice = ["from-another-tab"];
    await act(async () => dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: `${wishlist.WISHLIST_STORAGE_KEY}-sync` })));
    assert.deepEqual(plain(latest.slugs), ["from-another-tab"]);

    let resolveRead;
    pendingRead = new Promise((resolve) => { resolveRead = resolve; });
    await act(async () => latest.retry());
    pendingRead = null;
    auth.user = { id: "bob" };
    await render();
    assert.deepEqual(plain(latest.slugs), ["private"]);
    await act(async () => resolveRead(Response.json({ userId: "alice", slugs: ["stale-private-item"] })));
    assert.deepEqual(plain(latest.slugs), ["private"]);

    auth.user = null;
    await render();
    assert.deepEqual(plain(latest.slugs), []);
    await act(async () => latest.toggleItem("guest-again"));
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), '["guest-again"]');

    // A failed merge retains device data and the last successfully read account data.
    failWrite = true;
    auth.user = { id: "alice" };
    await render();
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), '["guest-again"]');
    assert.deepEqual(plain(latest.slugs), ["from-another-tab"]);
    assert.ok(latest.ready && latest.error);
    failWrite = false;
    await act(async () => latest.retry());
    assert.equal(dom.window.localStorage.getItem(wishlist.WISHLIST_STORAGE_KEY), "[]");

    // Initial load failure stays distinguishable from an empty wishlist.
    failRead = true;
    auth.user = { id: "bob" };
    await render();
    assert.equal(latest.ready, false);
    assert.ok(latest.error);
    failRead = false;
    await act(async () => latest.retry());
    assert.deepEqual(plain(latest.slugs), ["private"]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
