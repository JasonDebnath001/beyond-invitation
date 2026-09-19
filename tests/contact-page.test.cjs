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
  vm.runInNewContext(compiled, { exports, console: { log() {}, error() {} }, process: { env: {} }, require(name) {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, ...globals });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const helpers = load("lib/contact.ts");
const siteConfig = load("lib/site-config.ts");
const product = { slug: "535093", designNo: "535093", name: "Ivory invitation", image: "/card.jpg", subject: "Hindu Wedding Card", minOrderQty: 50 };

test("contact subjects map to exact ERP requirement and card-type values", () => {
  for (const subject of ["Hindu", "Muslim", "Christian"]) {
    assert.deepEqual(plain(helpers.requirementFromSubject(`${subject} Wedding Card`)), { requirement: "Wedding Cards", subRequirement: `${subject} Wedding Cards` });
  }
  for (const subject of ["Wedding Card", "Wedding Box"]) assert.deepEqual(plain(helpers.requirementFromSubject(subject)), { requirement: "Wedding Cards", subRequirement: "General Wedding Cards" });
  assert.deepEqual(plain(helpers.requirementFromSubject("Shagun Envelopes")), { requirement: "Sagun Envelopes", subRequirement: "" });
  assert.deepEqual(plain(helpers.requirementFromSubject("Rakhi")), { requirement: "Rakhi Packaging Item", subRequirement: "" });
  for (const subject of ["", "Bengali", "Tamil", "Other"]) assert.deepEqual(plain(helpers.requirementFromSubject(subject)), { requirement: "", subRequirement: "" });
});

test("Indian mobiles normalise prefixes and punctuation without altering a ten-digit number", () => {
  for (const value of ["+91 70448 15488", "917044815488", "07044815488", "70448-15488", "7044815488"]) {
    assert.equal(helpers.normaliseMobile(value), "7044815488");
    assert.equal(helpers.isValidIndianMobile(helpers.normaliseMobile(value)), true);
  }
  assert.equal(helpers.normaliseMobile("9123456789"), "9123456789");
  for (const value of ["12345", "1234567890", "70448154888", "", "70448abc88", "+91 70448 15488"]) assert.equal(helpers.isValidIndianMobile(value), false);
});

test("WhatsApp links encode the message and enquiry messages prepend a design once", () => {
  const text = "Hello, design 535093 & gold?";
  assert.equal(helpers.buildWhatsAppUrl("917044815488", text), `https://wa.me/917044815488?text=${encodeURIComponent(text)}`);
  const line = "Design no: 535093 — Ivory invitation";
  assert.equal(helpers.buildEnquiryMessage(product, "Gold foil"), `${line}\nGold foil`);
  assert.equal(helpers.buildEnquiryMessage(product, `${line}\nGold foil\n${line}`), `${line}\nGold foil`);
  assert.equal(helpers.buildEnquiryMessage(null, "  Gold foil  "), "Gold foil");
  assert.equal(helpers.formatInr(125000.5), "1,25,000.5");
});

async function withForm(productProp, run, response = { ok: true, json: async () => ({ success: true }) }) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000/contact" });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const calls = [];
  const motion = { expand(el) { el.hidden = false; }, collapse(el) { el.hidden = true; }, countTo(el, value, format) { el.textContent = format(value); }, drawCheck() {} };
  const imports = {
    react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/contact": helpers, "@/lib/site-config": siteConfig,
    "@/lib/product-name": load("lib/product-name.ts"),
    "next/image": ({ fill, ...props }) => React.createElement("img", props),
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "lucide-react": { ImageOff: () => null, ChevronDown: () => null },
    "@/components/contact/ContactMotion": { ContactMotion: ({ children }) => children, useContactMotion: () => motion },
  };
  const globals = { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, fetch: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (response instanceof Error) throw response;
    return response;
  } };
  for (const name of ["ProductEnquiryBanner", "EnquirySuccess"]) imports[`@/components/contact/${name}`] = load(`components/contact/${name}.tsx`, imports, globals);
  const Form = load("components/contact/EnquiryForm.tsx", imports, globals).default;
  const choose = async value => React.act(async () => document.querySelector(`input[type=radio][value="${value}"]`).click());
  const fill = async (name, value) => React.act(async () => {
    const el = document.querySelector(`[name="${name}"]`);
    const prototype = el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, value);
    el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
  const submit = async () => React.act(async () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  const click = async text => React.act(async () => [...document.querySelectorAll("button")].find(el => el.textContent === text).click());
  try {
    await React.act(async () => root.render(React.createElement(Form, { enquiryProduct: productProp })));
    await run({ calls, choose, fill, submit, click, React });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close(); delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("card type appears for wedding cards, is required, and clears for a Rakhi submission", async () => withForm(null, async ({ choose, fill, submit, calls }) => {
  assert.equal(document.querySelector('[name="subRequirement"]'), null);
  await choose("Wedding Cards");
  assert.equal(document.querySelector('[name="subRequirement"]').required, true);
  assert.equal(document.getElementById("enquiry-card-type").hidden, false);
  await submit();
  assert.equal(document.activeElement.name, "subRequirement");
  await fill("subRequirement", "Hindu Wedding Cards");
  await choose("Rakhi Packaging Item");
  assert.equal(document.getElementById("enquiry-card-type").hidden, true);
  assert.equal(document.querySelector('[name="subRequirement"]').value, "");
  assert.equal(document.querySelector('[name="subRequirement"]').required, false);
  await fill("name", "Anita Sharma"); await fill("mobile", "7044815488"); await submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/contact-lead");
  assert.equal(calls[0].body.subRequirement, "");
  assert.equal(calls[0].body.requirement, "Rakhi Packaging Item");
  assert.equal(calls[0].body.source, "Website");
  assert.match(document.querySelector('[role="status"]').textContent, /Thank you, Anita\./);
}));

test("invalid mobile blocks submission, describes the error, and receives focus", async () => withForm(null, async ({ choose, fill, submit, calls }) => {
  await choose("Sagun Envelopes"); await fill("name", "Anita"); await fill("mobile", "12345"); await submit();
  assert.equal(calls.length, 0);
  assert.equal(document.activeElement.name, "mobile");
  assert.equal(document.activeElement.getAttribute("aria-invalid"), "true");
  assert.equal(document.getElementById(document.activeElement.getAttribute("aria-describedby")).textContent, "Enter a 10-digit mobile number.");
}));

test("honeypot displays normal success without making a request, even before validation", async () => withForm(null, async ({ fill, submit, calls }) => {
  await fill("name", "Anita Sharma"); await fill("website", "https://spam.test"); await submit();
  assert.equal(calls.length, 0);
  assert.match(document.querySelector('[role="status"]').textContent, /Thank you, Anita\./);
}));

test("a product preselects fields, preserves its design line, and survives form reset", async () => withForm(product, async ({ fill, submit, click, calls }) => {
  assert.equal(document.querySelector('input[type="radio"]:checked').value, "Wedding Cards");
  assert.equal(document.querySelector('[name="subRequirement"]').value, "Hindu Wedding Cards");
  assert.equal(document.querySelector('[name="message"]').value, "Design no: 535093 — Ivory invitation");
  await fill("name", "Anita Sharma"); await fill("mobile", "7044815488"); await fill("message", "Gold foil, Kolkata");
  await fill("quantity", "50"); await click("Add a budget (optional)"); await fill("budgetPerUnit", "25.50");
  assert.match(document.getElementById("enquiry-budget").textContent, /Estimated total ₹1,275/);
  await submit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.message, "Design no: 535093 — Ivory invitation\nGold foil, Kolkata");
  assert.equal(calls[0].body.quantity, "50"); assert.equal(calls[0].body.budgetPerUnit, "25.50"); assert.equal(calls[0].body.totalBudget, "1275");
  assert.match(document.querySelector('[role="status"]').textContent, /Our team will contact you on \+91 7044815488/);
  assert.match(decodeURIComponent(document.querySelector('[role="status"] a').href), /design 535093/);
  await click("Send another enquiry");
  assert.ok(document.querySelector('[data-motion="product-banner"]'));
  assert.equal(document.querySelector('[name="name"]').value, ""); assert.equal(document.querySelector('[name="mobile"]').value, "");
  assert.equal(document.querySelector('[name="quantity"]').value, "");
  assert.equal(document.querySelector('[name="message"]').value, "Design no: 535093 — Ivory invitation");
}));

test("API messages and network failures render inline while preserving entered details", async () => {
  for (const response of [{ ok: false, json: async () => ({ success: false, message: "Please try again shortly." }) }, new Error("offline")]) {
    await withForm(null, async ({ choose, fill, submit, calls }) => {
      await choose("Rakhi Packaging Item"); await fill("name", "Anita"); await fill("mobile", "7044815488"); await submit();
      assert.equal(calls.length, 1);
      assert.match(document.querySelector('[role="alert"]').textContent, response instanceof Error ? /We could not send your enquiry/ : /Please try again shortly/);
      if (response instanceof Error) assert.match(document.querySelector('[role="alert"] a').href, /wa.me/);
      assert.equal(document.querySelector('[name="name"]').value, "Anita");
      assert.equal(document.querySelector('[type="submit"]').disabled, false);
    }, response);
  }
});

function route(env = { ERPNEXT_URL: "https://erp.test", ERPNEXT_API_KEY: "test", ERPNEXT_API_SECRET: "test" }) {
  const calls = [];
  const api = load("app/api/contact-lead/route.ts", { "next/server": { NextResponse }, "@/lib/contact": helpers }, {
    process: { env }, fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, text: async () => JSON.stringify({ data: { name: "LEAD-TEST" } }) }; },
  });
  return { api, calls };
}
const request = body => new Request("https://shop.test/api/contact-lead", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

test("lead honeypot returns success without ERP calls or configured credentials", async () => {
  const { api, calls } = route({});
  const response = await api.POST(request({ website: "bot.test" }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true }); assert.equal(calls.length, 0);
});

test("lead route rejects invalid mobiles and normalises valid ones without changing ERP mapping", async () => {
  const { api, calls } = route();
  const body = { name: "Anita", mobile: "12345", requirement: "Rakhi Packaging Item", subRequirement: "Hindu Wedding Cards", source: "Website", quantity: "50", budgetPerUnit: "25.5", totalBudget: "1275", message: "Gold foil" };
  const invalid = await api.POST(request(body));
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).message, "Enter a 10-digit mobile number."); assert.equal(calls.length, 0);
  assert.equal((await api.POST(request({ ...body, mobile: "+91 70448 15488" }))).status, 200);
  assert.equal(calls[0].body.mobile_no, "7044815488");
  assert.equal(calls[0].body.custom_requirement, "Rakhi Packaging Item");
  assert.equal(calls[0].body.custom_sub_requirement, undefined); assert.equal(calls[0].body.source, undefined);
  assert.equal(calls[0].body.custom_quantity_required, 50); assert.equal(calls[0].body.custom_budget_total, 1275);
  assert.equal(calls[0].body.custom_special_requirement_and_remark, "Gold foil");
  assert.equal((await api.POST(request({ ...body, mobile: "7044815488", requirement: "Wedding Cards", subRequirement: "" }))).status, 400);
});

test("contact server page passes a plain product and falls back safely for unknown or failed lookups", async () => {
  const React = require("react");
  const Form = () => null;
  const collectForm = element => {
    if (!React.isValidElement(element)) return null;
    if (element.type === Form) return element;
    return React.Children.toArray(element.props.children).map(collectForm).find(Boolean) || null;
  };
  for (const mode of ["product", "unknown", "error"]) {
    let resolved;
    const page = load("app/contact/page.tsx", {
      "react/jsx-runtime": require("react/jsx-runtime"), "next/link": () => null,
      "@/components/contact/ContactMotion": { ContactMotion: ({ children }) => children },
      "@/components/contact/ContactChannels": () => null, "@/components/contact/EnquiryForm": Form,
      "@/lib/site-config": siteConfig,
      "@/lib/catalog": { fetchErpProductBySlug: async slug => { resolved = slug; if (mode === "error") throw Error("offline"); return mode === "unknown" ? null : { ...product, itemCode: product.designNo, images: [product.image] }; } },
    });
    const element = await page.default({ searchParams: Promise.resolve({ product: "535093" }) });
    assert.equal(resolved, "535093");
    assert.deepEqual(plain(collectForm(element).props.enquiryProduct), mode === "product" ? product : null);
    assert.equal(page.metadata.alternates.canonical, "/contact");
  }
});
