const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test, after } = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
after(() => dom.window.close());

function load(file, dependencies = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file,
  });
  const imports = { react: React, "react/jsx-runtime": require("react/jsx-runtime"), ...dependencies };
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected test import: ${name}`);
    return imports[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

async function setup({ initialPoint, suggestedLocation, mapFails = false } = {}) {
  const mapEvents = {};
  const markerEvents = {};
  let coordinates = [0, 0];
  let geolocation;
  let saved = initialPoint;
  let invalidated = 0;
  let removed = 0;
  let tiles;
  let setDisabled;
  let setSuggestion;
  let setAcceptedPoint;
  const views = [];
  const fakeMap = {
    setView(point, zoom) { views.push({ point, zoom }); return this; },
    on(name, callback) { mapEvents[name] = callback; return this; },
    getCenter() { return { lat: 19.07, lng: 72.87 }; },
    remove() { removed++; },
  };
  const fakeMarker = {
    addTo() { return this; },
    on(name, callback) { markerEvents[name] = callback; return this; },
    setLatLng(point) { coordinates = point; return this; },
    getLatLng() { return { lat: coordinates[0], lng: coordinates[1] }; },
  };
  const leaflet = {
    map() { if (mapFails) throw new Error("Map unavailable"); return fakeMap; },
    tileLayer(url, options) { tiles = { url, options }; return { addTo() {} }; },
    divIcon(options) { return options; },
    marker(point) { coordinates = point; return fakeMarker; },
  };
  const Picker = load("components/DeliveryLocationPicker.tsx", {
    "@/lib/shipping": load("lib/shipping.ts"),
    "leaflet/dist/leaflet.css": {}, leaflet,
  }, { navigator: { geolocation: { getCurrentPosition(success, failure, options) { geolocation = { success, failure, options }; } } } }).default;
  function Controlled() {
    const [value, setValue] = React.useState(initialPoint);
    const [suggestion, updateSuggestion] = React.useState(suggestedLocation);
    const [disabled, updateDisabled] = React.useState(false);
    setDisabled = updateDisabled;
    setSuggestion = updateSuggestion;
    setAcceptedPoint = (point) => { saved = point; setValue(point); };
    return React.createElement(Picker, {
      value, disabled, suggestedLocation: suggestion,
      onConfirm(point) { saved = point; setValue(point); },
      onInvalidate() { invalidated++; saved = undefined; setValue(undefined); },
    });
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Controlled)));
  return {
    container, mapEvents, markerEvents, views,
    get coordinates() { return coordinates; },
    get saved() { return saved; }, get invalidated() { return invalidated; }, get removed() { return removed; },
    get tiles() { return tiles; }, get geolocation() { return geolocation; },
    async click(text) {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === text);
      assert.ok(button, `Button ${text} exists`);
      await React.act(async () => button.click());
    },
    async drag(point) { coordinates = point; await React.act(async () => markerEvents.dragend()); },
    async lock(value) { await React.act(async () => setDisabled(value)); },
    async suggest(value) { await React.act(async () => setSuggestion(value)); },
    async accept(value) { await React.act(async () => setAcceptedPoint(value)); },
    async close() { await React.act(async () => root.unmount()); container.remove(); },
  };
}

test("map click and dragging invalidate the saved point until explicitly confirmed", async () => {
  const ui = await setup({ initialPoint: { latitude: 19.076, longitude: 72.8777 } });
  try {
    assert.equal(ui.invalidated, 0, "Restoring the saved map pin does not invalidate it");
    assert.equal(ui.tiles.url, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    assert.match(ui.tiles.options.attribution, /OpenStreetMap/);
    await React.act(async () => ui.mapEvents.click({ latlng: { lat: 19.08, lng: 72.88 } }));
    assert.equal(ui.saved, undefined);
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, { latitude: 19.08, longitude: 72.88 });
    await ui.drag([19.09, 72.89]);
    assert.equal(ui.saved, undefined);
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, { latitude: 19.09, longitude: 72.89 });
    await ui.click("Use map centre");
    assert.equal(ui.saved, undefined);
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, { latitude: 19.07, longitude: 72.87 });
  } finally { await ui.close(); }
  assert.equal(ui.removed, 1);
});

test("a geocoded suggestion centres and prefills the map without accepting the destination", async () => {
  const point = { latitude: 19.076, longitude: 72.8777 };
  const ui = await setup({ suggestedLocation: point });
  try {
    assert.deepEqual(ui.views[0], { point: [point.latitude, point.longitude], zoom: 17 });
    assert.deepEqual(ui.coordinates, [point.latitude, point.longitude]);
    assert.equal(ui.saved, undefined);
    assert.equal(ui.invalidated, 0);
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, point);
    await ui.drag([19.08, 72.88]);
    assert.deepEqual(ui.coordinates, [19.08, 72.88], "Invalidation must not restore the earlier geocoded suggestion");
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, { latitude: 19.08, longitude: 72.88 });
  } finally { await ui.close(); }
});

test("late suggestions and accepted points move the map without invalidating a saved destination", async () => {
  const ui = await setup();
  try {
    await ui.suggest({ latitude: 19.1, longitude: 72.9 });
    assert.deepEqual(ui.coordinates, [19.1, 72.9]);
    assert.deepEqual(ui.views.at(-1), { point: [19.1, 72.9], zoom: 17 });
    assert.equal(ui.saved, undefined);
    assert.equal(ui.invalidated, 0);
    await ui.accept({ latitude: 19.2, longitude: 73.0 });
    assert.deepEqual(ui.coordinates, [19.2, 73.0]);
    assert.match(ui.container.textContent, /Delivery location confirmed/);
    assert.equal(ui.invalidated, 0);
    await ui.lock(true);
    await ui.suggest({ latitude: 19.3, longitude: 73.1 });
    await ui.lock(false);
    assert.deepEqual(ui.coordinates, [19.2, 73.0], "A late suggestion cannot replace an accepted payment destination");
  } finally { await ui.close(); }
});

test("geolocation is requested only by the customer and still requires pin confirmation", async () => {
  const ui = await setup();
  try {
    assert.equal(ui.geolocation, undefined);
    await ui.click("Use my current location");
    assert.equal(ui.geolocation.options.enableHighAccuracy, true);
    await React.act(async () => ui.geolocation.success({ coords: { latitude: 19.1, longitude: 72.9 } }));
    assert.equal(ui.saved, undefined);
    await ui.click("Confirm delivery location");
    assert.deepEqual(ui.saved, { latitude: 19.1, longitude: 72.9 });
    await ui.click("Use my current location");
    await React.act(async () => ui.geolocation.failure());
    assert.match(ui.container.textContent, /You can still choose your delivery point on the map/);
  } finally { await ui.close(); }
});

test("a map loading failure explains how to continue without enabling confirmation", async () => {
  const ui = await setup({ mapFails: true });
  try {
    assert.match(ui.container.textContent, /map could not load/);
    assert.match(ui.container.textContent, /choose standard delivery/);
    const confirm = [...ui.container.querySelectorAll("button")].find((button) => button.textContent === "Confirm delivery location");
    assert.equal(confirm.disabled, true);
  } finally { await ui.close(); }
});

test("payment lock prevents map edits and permanently discards a pending geolocation callback", async () => {
  const initialPoint = { latitude: 19.076, longitude: 72.8777 };
  const ui = await setup({ initialPoint });
  try {
    await ui.click("Use my current location");
    const pendingLookup = ui.geolocation;
    await ui.lock(true);
    for (const button of ui.container.querySelectorAll("button")) assert.equal(button.disabled, true);
    assert.equal(ui.container.querySelector('[role="region"]').hasAttribute("inert"), true);
    await React.act(async () => ui.mapEvents.click({ latlng: { lat: 20, lng: 73 } }));
    await ui.drag([20, 73]);
    assert.deepEqual(ui.saved, initialPoint);
    assert.equal(ui.invalidated, 0);
    await ui.lock(false);
    await React.act(async () => pendingLookup.success({ coords: { latitude: 21, longitude: 74 } }));
    assert.deepEqual(ui.saved, initialPoint, "A lookup started before payment cannot change the pin even after a dismissed payment unlocks it");
    assert.equal(ui.invalidated, 0);
    await ui.click("Use my current location");
    await React.act(async () => ui.geolocation.success({ coords: { latitude: 21, longitude: 74 } }));
    assert.equal(ui.saved, undefined, "New location requests work after payment is dismissed");
  } finally { await ui.close(); }
});
