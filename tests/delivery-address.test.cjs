const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
      return imports[name];
    },
    module,
    module.exports,
  );
  return module.exports;
}
const api = load("lib/delivery-address.ts", {
  "@/lib/shipping": load("lib/shipping.ts"),
});
const address = {
  addressLine1: "1 Example Road",
  addressLine2: "Flat 2",
  city: "Kolkata",
  state: "West Bengal",
  pincode: "700001",
  country: "India",
};

test("only bounded full Indian delivery addresses are eligible for automatic lookup", () => {
  assert.deepEqual(api.normalizeDeliveryAddress(address), address);
  assert.deepEqual(
    api.normalizeDeliveryAddress({
      ...address,
      addressLine2: undefined,
      country: "in",
    }),
    { ...address, addressLine2: "" },
  );
  for (const field of ["addressLine1", "city", "state", "pincode", "country"]) {
    assert.equal(
      api.normalizeDeliveryAddress({ ...address, [field]: "" }),
      null,
      field,
    );
  }
  for (const invalid of [
    null,
    [],
    "address",
    { ...address, pincode: 700001 },
    { ...address, pincode: "000000" },
    { ...address, country: "USA" },
    { ...address, addressLine1: "a".repeat(201) },
    { ...address, city: "x".repeat(81) },
    { ...address, addressLine1: "1 Example\u0000Road" },
    { ...address, addressLine2: {} },
  ]) {
    assert.equal(api.normalizeDeliveryAddress(invalid), null);
    assert.equal(api.deliveryAddressKey(invalid), "");
  }
});

test("address normalization never forwards contact details, notes or unknown fields", () => {
  const normalized = api.normalizeDeliveryAddress({
    ...address,
    name: "PRIVATE NAME",
    email: "private@example.test",
    contact: "PRIVATE PHONE",
    notes: "PRIVATE NOTE",
  });
  assert.deepEqual(normalized, address);
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE/);
});

test("lookup identity tolerates whitespace and case but invalidates every delivery-address edit", () => {
  const key = api.deliveryAddressKey(address);
  assert.equal(
    api.deliveryAddressKey({
      ...address,
      addressLine1: "  1 EXAMPLE\tRoad  ",
      city: "kolkata",
      country: "IN",
    }),
    key,
  );
  for (const [field, replacement] of Object.entries({
    addressLine1: "2 Example Road",
    addressLine2: "Flat 3",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "700002",
  })) {
    assert.notEqual(
      api.deliveryAddressKey({ ...address, [field]: replacement }),
      key,
      field,
    );
  }
});
