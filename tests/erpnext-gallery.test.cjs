const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the public product loaders with ERP responses, without credentials
// or a Next.js request context. Keep each scenario's environment isolated.
const compiled = ts.transpileModule(
  readFileSync(path.join(__dirname, "../lib/erpnext.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  },
).outputText;

const origin = "https://erp.example.test";
const image = (name) => `${origin}/files/${name}.png`;
const file = (name, order, extra = {}) => ({
  name,
  file_name: `${name}.png`,
  file_url: `/files/${name}.png`,
  attached_to_doctype: "Item",
  attached_to_name: "TEST-CARD",
  is_folder: 0,
  is_private: 0,
  custom_photo_order: order,
  ...extra,
});

function loadErp({
  files = [],
  doc = {},
  env = {},
  rejectWildcard = false,
} = {}) {
  const item = {
    name: "TEST-CARD",
    item_code: "TEST-CARD",
    item_name: "Test invitation",
    image: "/files/B.png",
    disabled: 0,
    custom_show_on_website: 1,
    custom_price: 100,
    ...doc,
  };
  const exports = {};
  const context = vm.createContext({
    exports,
    URL,
    process: {
      env: {
        ERPNEXT_URL: origin,
        ERPNEXT_API_KEY: "test",
        ERPNEXT_API_SECRET: "test",
        ...env,
      },
    },
    require(name) {
      if (name === "isomorphic-dompurify")
        return { sanitize: (value) => value };
      if (name === "@/lib/reseller")
        return {
          applyResellerPricingToProducts: (products) => products,
          applyResellerPricingToProduct: (product) => product,
        };
      throw new Error(`Unexpected import: ${name}`);
    },
    async fetch(input) {
      const url = new URL(input);
      const resource = decodeURIComponent(url.pathname);
      let data;
      if (resource === "/api/resource/Item") data = [item];
      else if (resource === "/api/resource/Item/TEST-CARD") data = item;
      else if (resource === "/api/resource/Item Price") data = [];
      else if (resource === "/api/resource/File") {
        const fields = JSON.parse(url.searchParams.get("fields"));
        if (rejectWildcard && fields.includes("*")) {
          return {
            ok: false,
            status: 403,
            text: async () => "Field not permitted",
          };
        }
        const filters = JSON.parse(url.searchParams.get("filters"));
        data = files.filter((record) =>
          filters.every(([, field, operator, value]) =>
            operator === "in"
              ? value.includes(record[field])
              : record[field] === value,
          ),
        );
        data = data.map((record) =>
          fields.includes("*")
            ? record
            : Object.fromEntries(fields.map((field) => [field, record[field]])),
        );
      } else throw new Error(`Unexpected ERP request: ${resource}`);
      return { ok: true, json: async () => ({ data }) };
    },
  });
  vm.runInContext(compiled, context);
  return exports;
}

async function checkImages(fixture, expected, expectedVideos = []) {
  const erp = loadErp(fixture);
  const catalog = await erp.fetchErpProductsBase();
  const detail = await erp.fetchErpProductBySlug("test-card");
  for (const product of [catalog[0], detail]) {
    assert.deepEqual(Array.from(product.images), expected);
    assert.deepEqual(Array.from(product.videos || []), expectedVideos);
  }
}

test("File photo order overrides upload order and Item.image in catalog and detail", async () => {
  await checkImages(
    { files: [file("B", "3"), file("C", "1"), file("D", "2")] },
    [image("C"), image("D"), image("B")],
  );
});

test("zero on an earlier duplicate does not hide a valid photo order", async () => {
  await checkImages(
    {
      files: [
        file("B", 0),
        file("C", 0),
        file("D", 0),
        file("B", 3, { name: "B-ordered" }),
        file("C", 1, { name: "C-ordered" }),
        file("D", 2, { name: "D-ordered" }),
      ],
    },
    [image("C"), image("D"), image("B")],
  );
});

test("a populated alternate photo-order field is used when the default is zero", async () => {
  await checkImages(
    {
      files: [
        file("B", 0, { photo_order: "3" }),
        file("C", 0, { photo_order: "1" }),
        file("D", 0, { photo_order: "2" }),
      ],
    },
    [image("C"), image("D"), image("B")],
  );
});

test("configured photo-order field takes precedence over alternate fields", async () => {
  await checkImages(
    {
      env: { ERPNEXT_FILE_PHOTO_ORDER_FIELD: "custom_display_position" },
      files: [
        file("B", 1, { custom_display_position: 3 }),
        file("C", 2, { custom_display_position: 1 }),
        file("D", 3, { custom_display_position: 2 }),
      ],
    },
    [image("C"), image("D"), image("B")],
  );
});

test("unnumbered photos fill gaps and videos do not consume photo positions", async () => {
  await checkImages(
    {
      files: [
        file("B", 0),
        file("C", 2),
        file("D", null),
        file("video", 1, { file_url: "/files/clip", file_name: "clip.mp4" }),
      ],
    },
    [image("B"), image("C"), image("D")],
    [`${origin}/files/clip`],
  );
});

test("a private duplicate blocks the image and unrelated uploads cannot change order", async () => {
  await checkImages(
    {
      files: [
        file("B", 3),
        file("C", 1),
        file("D", 2),
        file("B", 0, {
          name: "B-private",
          is_private: 1,
          attached_to_name: "OTHER",
        }),
        file("unrelated", 1, { file_name: "B.png", attached_to_name: "OTHER" }),
        file("B", 1, { name: "B-other", attached_to_name: "OTHER" }),
      ],
    },
    [image("C"), image("D")],
  );
});

test("primary image remains first without gallery rows or photo positions", async () => {
  await checkImages({ files: [file("C", 0), file("D", 0), file("B", 0)] }, [
    image("B"),
    image("C"),
    image("D"),
  ]);
});

test("restricted field queries retain explicit photo order", async () => {
  await checkImages(
    { rejectWildcard: true, files: [file("B", 3), file("C", 1), file("D", 2)] },
    [image("C"), image("D"), image("B")],
  );
});
