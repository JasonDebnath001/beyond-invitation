const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

function load(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    console,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const logs = [];
let products = [];
let catalogError = null;
const account = load(
  "lib/account.ts",
  {
    "server-only": {},
    "@/lib/catalog": {
      getCatalogProducts: async () => {
        if (catalogError) throw catalogError;
        return products;
      },
    },
  },
  { console: { error: (...args) => logs.push(args) } },
);

function clientFor(result) {
  const calls = [];
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "eq", "or", "order", "limit"]) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  return {
    calls,
    from: (table) => {
      calls.push(["from", table]);
      return query;
    },
  };
}

test("account identity helpers use names, email fallbacks and identity providers", () => {
  const named = {
    email: "test@example.com",
    user_metadata: { full_name: "  Test Middle Person  " },
  };
  assert.equal(account.displayName(named), "Test Middle Person");
  assert.equal(account.initials(named), "TP");
  assert.equal(
    account.initials({ ...named, user_metadata: { name: "Mira" } }),
    "M",
  );
  const emailOnly = { ...named, user_metadata: { full_name: "  " } };
  assert.equal(account.displayName(emailOnly), "test");
  assert.equal(account.initials(emailOnly), "T");
  assert.equal(
    account.hasEmailIdentity({ ...named, identities: [{ provider: "email" }] }),
    true,
  );
  assert.equal(
    account.hasEmailIdentity({
      ...named,
      identities: [{ provider: "google" }],
    }),
    false,
  );
  assert.equal(account.hasEmailIdentity(named), false);
});

test("account presentation formats INR, Indian dates and abbreviated references on the server", () => {
  assert.equal(account.formatInr(123456), "₹1,234.56");
  assert.equal(account.formatInr(123456789), "₹12,34,567.89");
  assert.equal(account.formatOrderDate("2026-09-16T20:00:00Z"), "17 Sept 2026");
  assert.equal(account.orderReference("abcd1234-5678-90ef"), "Order #ABCD1234");
});

test("missing order relations and query failures return empty lists and log each failure once", async () => {
  for (const code of ["42P01", "PGRST205", "42501"]) {
    const before = logs.length;
    const client = clientFor({ data: null, error: { code } });
    assert.deepEqual(
      plain(await account.fetchRecentWebsiteOrders(client, "owner")),
      [],
    );
    assert.equal(logs.length, before + 1);
    assert.ok(
      client.calls.some(
        ([method, column, value]) =>
          method === "eq" && column === "user_id" && value === "owner",
      ),
    );
  }
});

test("recent orders discard abandoned attempts, filter before limiting and strip private pricing fields", async () => {
  const row = {
    id: "abcd1234-5678",
    created_at: new Date().toISOString(),
    payment_status: "pending",
    amount_paise: 123456,
    razorpay_payment_id: "payment_test",
    razorpay_order_id: "private",
    reseller_code: "private",
    commission_paise: 10,
    items: [
      {
        name: "Wedding card",
        itemCode: "CARD-1",
        quantity: 2,
        price: 617.28,
        basePrice: 600,
      },
    ],
  };
  const client = clientFor({
    data: [
      row,
      { ...row, id: "old-pending", created_at: "2020-01-01T00:00:00Z" },
      {
        ...row,
        id: "old-paid",
        created_at: "2020-01-01T00:00:00Z",
        payment_status: "paid",
      },
    ],
    error: null,
  });
  const orders = plain(await account.fetchRecentWebsiteOrders(client, "owner"));
  assert.equal(orders.length, 2);
  assert.equal(orders[0].amount, "₹1,234.56");
  assert.equal(orders[0].items[0].unitPrice, "₹617.28");
  assert.equal(orders[0].items[0].total, "₹1,234.56");
  assert.equal(orders[0].paymentReference, "");
  assert.equal(orders[1].paymentReference, "payment_test");
  for (const field of [
    "basePrice",
    "commission_paise",
    "reseller_code",
    "razorpay_order_id",
  ])
    assert.ok(!JSON.stringify(orders).includes(field));
  assert.match(
    client.calls.find(([method]) => method === "or")[1],
    /payment_status.eq.paid,and\(payment_status.eq.pending,created_at.gte\./,
  );
  assert.ok(
    client.calls.findIndex(([method]) => method === "or") <
      client.calls.findIndex(([method]) => method === "limit"),
  );
  assert.deepEqual(
    client.calls.find(([method]) => method === "limit"),
    ["limit", 10],
  );
  assert.deepEqual(plain(client.calls.find(([method]) => method === "order")), [
    "order",
    "created_at",
    { ascending: false },
  ]);
});

test("saved designs resolve catalogue pricing, ignore retired slugs and tolerate missing catalogue configuration", async () => {
  products = Array.from({ length: 7 }, (_, i) => ({
    slug: `card-${i}`,
    name: `Card ${i}`,
    images: ["/card.jpg"],
    price: 100 + i,
    mrp: 150,
  }));
  const client = clientFor({
    data: [
      { product_slug: "retired" },
      ...products.map(({ slug }) => ({ product_slug: slug })),
    ],
    error: null,
  });
  const saved = plain(await account.fetchSavedProducts(client, "owner"));
  assert.equal(saved.length, 6);
  assert.equal(saved[0].slug, "card-0");
  assert.equal(saved[0].price, 100);
  assert.ok(
    client.calls.some(
      ([method, column, value]) =>
        method === "eq" && column === "user_id" && value === "owner",
    ),
  );
  catalogError = new Error("missing env");
  const before = logs.length;
  assert.deepEqual(
    plain(await account.fetchSavedProducts(client, "owner")),
    [],
  );
  assert.equal(logs.length, before + 1);
  catalogError = null;
  assert.deepEqual(
    plain(
      await account.fetchSavedProducts(
        clientFor({ error: { code: "42P01" } }),
        "owner",
      ),
    ),
    [],
  );
});

test("overview counts use owned paid orders and the complete wishlist independently of preview limits", async () => {
  const client = clientFor({ count: 23, error: null });
  assert.deepEqual(plain(await account.fetchAccountCounts(client, "owner")), {
    paidOrders: 23,
    savedDesigns: 23,
  });
  assert.equal(
    client.calls.filter(
      ([method, column, value]) =>
        method === "eq" && column === "user_id" && value === "owner",
    ).length,
    2,
  );
  assert.ok(
    client.calls.some(
      ([method, column, value]) =>
        method === "eq" && column === "payment_status" && value === "paid",
    ),
  );
  assert.ok(!client.calls.some(([method]) => method === "limit"));
});

test("orders progressively enhance visible server HTML and toggle the accessible panel with motion helpers", async () => {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: "http://localhost:3000",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { renderToStaticMarkup } = require("react-dom/server");
  const calls = [];
  const imports = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": ({ children, ...props }) =>
      React.createElement("a", props, children),
    "next/image": () => null,
    "lucide-react": {
      ChevronDown: () => null,
      Package: () => null,
      ArrowUpRight: () => null,
    },
    gsap: { to: () => {}, set: () => {}, killTweensOf: () => {} },
    "./AccountMotion": {
      useAccountMotion: () => ({
        open: (node) => calls.push(["open", node.id]),
        close: (node) => calls.push(["close", node.id]),
      }),
    },
  };
  imports["@/lib/product-name"] = load("lib/product-name.ts");
  imports["./AccountUI"] = load("components/account/AccountUI.tsx", imports);
  const Orders = load("components/account/AccountOrders.tsx", imports).default;
  const order = {
    id: "abcd1234-full-id",
    reference: "Order #ABCD1234",
    date: "17 Sept 2026",
    amount: "₹1,234.56",
    status: "paid",
    itemCount: 2,
    items: [
      {
        name: "Wedding card",
        itemCode: "CARD-1",
        quantity: 2,
        unitPrice: "₹617.28",
        total: "₹1,234.56",
      },
    ],
    paymentReference: "pay_test",
  };
  const element = React.createElement(Orders, { orders: [order] });
  const html = renderToStaticMarkup(element);
  assert.match(html, /Wedding card/);
  assert.doesNotMatch(html, /height:0|visibility:hidden|opacity:0/);
  const root = createRoot(document.getElementById("root"));
  try {
    await React.act(async () => root.render(element));
    const button = document.querySelector("button[aria-expanded]");
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.getAttribute("aria-hidden"), "true");
    await React.act(async () => button.click());
    assert.equal(button.getAttribute("aria-expanded"), "true");
    assert.equal(panel.getAttribute("aria-hidden"), "false");
    assert.deepEqual(calls.at(-1), ["open", panel.id]);
    await React.act(async () => button.click());
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.deepEqual(calls.at(-1), ["close", panel.id]);
    await React.act(async () =>
      root.render(React.createElement(Orders, { orders: [] })),
    );
    assert.match(document.body.textContent, /No orders yet\./);
    assert.equal(
      document.querySelector('a[href="/catalog"]').textContent,
      "Browse the catalogue",
    );
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
