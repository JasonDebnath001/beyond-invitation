const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

function load(file, dependencies = {}, globals = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(__dirname, "..", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: file,
    },
  );
  const imports = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    ...dependencies,
  };
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ...Object.keys(globals),
    outputText,
  )(
    (name) => {
      assert.ok(
        Object.hasOwn(imports, name),
        `Unexpected test import: ${name}`,
      );
      return imports[name];
    },
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}

const shipping = load("lib/shipping.ts");
const addresses = load("lib/delivery-address.ts", {
  "@/lib/shipping": shipping,
});
const fullAddress = {
  addressLine1: "12 Test Building, Example Street",
  addressLine2: "Near the park",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
};
const point = { latitude: 19.076, longitude: 72.8777 };
const correction = { latitude: 19.08, longitude: 72.88 };
const placeId = "ChIJTestDeliveryPlace_One";
const matched = {
  status: "matched",
  provider: "google",
  placeId,
  location: point,
  label: "Delivery address located",
};

async function setup({
  address = fullAddress,
  pending = false,
  response = matched,
  status = 200,
} = {}) {
  const requests = [];
  const changes = [];
  const timers = new Map();
  let timerId = 0;
  let setAddress, setDisabled, setVisible;
  let currentAddress = address;
  let accepted;
  let standardSelections = 0;
  const Component = load(
    "components/CheckoutDeliveryLocation.tsx",
    {
      "@/lib/shipping": shipping,
      "@/lib/delivery-address": addresses,
    },
    {
      fetch: async (url, options) => {
        assert.equal(
          url,
          "/api/locations/geocode",
          "Only a mocked address endpoint may be called",
        );
        assert.equal(options.method, "POST");
        const request = {
          body: JSON.parse(options.body),
          signal: options.signal,
          cache: options.cache,
        };
        requests.push(request);
        if (!pending) return Response.json(response, { status });
        return new Promise((resolve) => {
          request.resolve = resolve;
        });
      },
      setTimeout: (callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  ).default;
  function Controlled() {
    const [formAddress, updateAddress] = React.useState(address);
    const [disabled, updateDisabled] = React.useState(false);
    const [visible, updateVisible] = React.useState(true);
    const [saved, setSaved] = React.useState(null);
    setAddress = updateAddress;
    setDisabled = updateDisabled;
    setVisible = updateVisible;
    currentAddress = formAddress;
    const key = addresses.deliveryAddressKey(formAddress);
    accepted = saved?.key === key ? saved.location : undefined;
    return visible
      ? React.createElement(Component, {
          address: formAddress,
          value: accepted,
          disabled,
          onChange(location, addressKey, matchedPlaceId) {
            changes.push({
              location,
              key: addressKey,
              placeId: matchedPlaceId,
            });
            setSaved(
              location
                ? { location, key: addressKey, placeId: matchedPlaceId }
                : null,
            );
          },
          onSelectStandard() {
            standardSelections++;
            setSaved(null);
            updateVisible(false);
          },
        })
      : null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Controlled)));
  return {
    container,
    requests,
    changes,
    get accepted() {
      return accepted;
    },
    get standardSelections() {
      return standardSelections;
    },
    get currentAddress() {
      return currentAddress;
    },
    async flush({ wait = true } = {}) {
      await React.act(async () => {
        const work = [];
        for (const [id, timer] of [...timers]) {
          if (timer.delay !== 800) continue;
          timers.delete(id);
          work.push(timer.callback());
        }
        if (wait) await Promise.all(work);
      });
    },
    async resolve(index, data = matched, code = 200) {
      await React.act(async () =>
        requests[index].resolve(Response.json(data, { status: code })),
      );
    },
    async expire() {
      await React.act(async () => {
        for (const [id, timer] of [...timers]) {
          if (timer.delay !== 12_000) continue;
          timers.delete(id);
          timer.callback();
        }
      });
    },
    async fillAddress(value) {
      await React.act(async () => setAddress(value));
    },
    async lock(value) {
      await React.act(async () => setDisabled(value));
    },
    async hide() {
      await React.act(async () => setVisible(false));
    },
    async click(text) {
      const button = [...container.querySelectorAll("button")].find(
        (element) => element.textContent === text,
      );
      assert.ok(button, `Expected button: ${text}`);
      await React.act(async () => button.click());
    },
    async close() {
      await React.act(async () => root.unmount());
      container.remove();
    },
  };
}

test("a precise address match is accepted automatically without importing or rendering a map", async () => {
  const ui = await setup({
    address: {
      ...fullAddress,
      addressLine1: " 12 Test Building,  Example Street ",
      email: "PRIVATE_EMAIL",
      notes: "PRIVATE_NOTES",
    },
  });
  try {
    assert.equal(ui.requests.length, 0, "Address lookup is debounced");
    assert.equal(ui.container.childElementCount, 0, "Background lookup adds no checkout panel");
    await ui.flush();
    assert.equal(ui.requests.length, 1);
    assert.deepEqual(ui.requests[0].body, { address: fullAddress });
    assert.equal(ui.requests[0].cache, "no-store");
    assert.deepEqual(ui.accepted, point);
    assert.equal(ui.changes.length, 1);
    assert.equal(ui.changes[0].key, addresses.deliveryAddressKey(fullAddress));
    assert.equal(ui.changes[0].placeId, placeId);
    assert.equal(ui.container.childElementCount, 0, "A successful match remains invisible while supplying shipping coordinates");
    await ui.flush();
    assert.equal(ui.requests.length, 1);
  } finally {
    await ui.close();
  }
});

test("an approximate result never becomes shipping coordinates and offers address correction or explicit standard delivery", async () => {
  const ui = await setup({ response: { ...matched, status: "review" } });
  try {
    await ui.flush();
    assert.equal(ui.accepted, undefined);
    assert.equal(ui.changes.length, 0);
    assert.match(
      ui.container.textContent,
      /building number, street and nearby landmark/,
    );
    assert.doesNotMatch(
      ui.container.textContent,
      /Confirm the pin|Choose location on map/,
    );
    assert.equal(
      ui.standardSelections,
      0,
      "There is no silent switch to standard delivery",
    );
    await ui.click("Use standard delivery");
    assert.equal(ui.standardSelections, 1);
    assert.equal(ui.accepted, undefined);
    assert.equal(ui.changes.length, 0);
  } finally {
    await ui.close();
  }
});

test("incomplete addresses do not query and matching starts only when required address fields are ready", async () => {
  const ui = await setup({
    address: { ...fullAddress, addressLine1: "", city: "" },
  });
  try {
    await ui.flush();
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.container.childElementCount, 0);
    await ui.fillAddress({ ...fullAddress, pincode: "40000" });
    await ui.flush();
    assert.equal(ui.requests.length, 0);
    await ui.fillAddress(fullAddress);
    await ui.flush();
    assert.equal(ui.requests.length, 1);
    assert.deepEqual(ui.accepted, point);
  } finally {
    await ui.close();
  }
});

test("address changes abort and ignore late results for the previous address", async () => {
  const ui = await setup({ pending: true });
  try {
    await ui.flush({ wait: false });
    await ui.fillAddress({
      ...fullAddress,
      addressLine1: "99 Other Building, New Street",
    });
    assert.equal(ui.requests[0].signal.aborted, true);
    await ui.resolve(0);
    assert.equal(ui.accepted, undefined);
    assert.equal(ui.changes.length, 0);
    await ui.flush({ wait: false });
    await ui.resolve(1, {
      ...matched,
      placeId: "ChIJTestDeliveryPlace_Two",
      location: correction,
    });
    assert.deepEqual(ui.accepted, correction);
    assert.equal(
      ui.changes[0].key,
      addresses.deliveryAddressKey(ui.currentAddress),
    );
    assert.equal(ui.changes[0].placeId, "ChIJTestDeliveryPlace_Two");
  } finally {
    await ui.close();
  }
});

test("switching delivery mode or leaving checkout aborts pending automatic lookup", async () => {
  const ui = await setup({ pending: true });
  try {
    await ui.flush({ wait: false });
    await ui.hide();
    assert.equal(ui.requests[0].signal.aborted, true);
    await ui.resolve(0);
    assert.equal(ui.changes.length, 0);
    assert.equal(ui.container.textContent, "");
  } finally {
    await ui.close();
  }
});

test("payment lock discards a pending lookup and prevents changing delivery service", async () => {
  const ui = await setup({ pending: true });
  try {
    await ui.flush({ wait: false });
    assert.equal(ui.container.childElementCount, 0, "Pending lookup has no status panel");
    await ui.lock(true);
    assert.equal(ui.requests[0].signal.aborted, true);
    assert.equal(ui.container.childElementCount, 0);
    assert.equal(ui.standardSelections, 0);
    await ui.resolve(0);
    assert.equal(ui.changes.length, 0);
    await ui.lock(false);
    await ui.flush({ wait: false });
    await ui.resolve(1, { ...matched, status: "review" });
    assert.equal(ui.accepted, undefined);
    await ui.lock(true);
    for (const button of ui.container.querySelectorAll("button"))
      assert.equal(button.disabled, true);
    await ui.click("Use standard delivery");
    assert.equal(ui.standardSelections, 0);
    await ui.lock(false);
    await ui.flush({ wait: false });
    await ui.resolve(2, { ...matched, status: "review" });
    await ui.click("Use standard delivery");
    assert.equal(ui.standardSelections, 1);
  } finally {
    await ui.close();
  }
});

test("clearing required address fields cancels hidden lookup so its late result cannot restore Quick coordinates", async () => {
  const ui = await setup({ pending: true });
  try {
    await ui.flush({ wait: false });
    await ui.fillAddress({ ...fullAddress, addressLine1: "" });
    assert.equal(ui.requests[0].signal.aborted, true);
    await ui.resolve(0);
    assert.equal(ui.accepted, undefined);
    assert.equal(ui.changes.length, 0);
    assert.equal(ui.container.childElementCount, 0);
    await ui.flush();
    assert.equal(ui.requests.length, 1);
  } finally {
    await ui.close();
  }
});

test("unavailable and missing-address results offer retry and standard delivery without exposing upstream errors", async () => {
  for (const first of [
    {
      data: {
        error: "PRIVATE_API_KEY upstream error",
        code: "GEOCODING_UNAVAILABLE",
      },
      code: 503,
    },
    { data: { status: "not_found" }, code: 200 },
    {
      data: { status: "matched", location: { latitude: "19", longitude: 72 } },
      code: 200,
    },
    { data: { ...matched, placeId: undefined }, code: 200 },
    { data: { ...matched, placeId: "" }, code: 200 },
    { data: { ...matched, placeId: "PRIVATE\nINVALID_PLACE" }, code: 200 },
    { data: { ...matched, provider: "other" }, code: 200 },
  ]) {
    const ui = await setup({ pending: true });
    try {
      await ui.flush({ wait: false });
      await ui.resolve(0, first.data, first.code);
      assert.equal(ui.accepted, undefined);
      assert.doesNotMatch(
        ui.container.textContent,
        /PRIVATE_API_KEY|upstream error/,
      );
      assert.equal(ui.container.querySelector("iframe, canvas, img"), null);
      assert.match(ui.container.textContent, /Use standard delivery/);
      await ui.click("Retry address lookup");
      await ui.flush({ wait: false });
      assert.equal(ui.requests.length, 2);
      await ui.resolve(1);
      assert.deepEqual(ui.accepted, point);
    } finally {
      await ui.close();
    }
  }
});

test("a timed-out lookup allows standard delivery and ignores the eventual automatic result", async () => {
  const ui = await setup({ pending: true });
  try {
    await ui.flush({ wait: false });
    await ui.expire();
    assert.equal(ui.requests[0].signal.aborted, true);
    assert.match(
      ui.container.textContent,
      /Automatic address lookup is temporarily unavailable/,
    );
    assert.equal(ui.accepted, undefined);
    await ui.click("Use standard delivery");
    await ui.resolve(0);
    assert.equal(ui.accepted, undefined);
    assert.equal(ui.changes.length, 0);
    assert.equal(ui.standardSelections, 1);
  } finally {
    await ui.close();
  }
});
