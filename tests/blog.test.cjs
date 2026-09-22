const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { NextRequest } = require("next/server");

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, Buffer, URL, Date, File, FormData, Response, Request, AbortSignal, console,
      require(name) {
        if (name in mocks) return mocks[name];
        if (name === "server-only" || name.endsWith(".css")) return {};
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
        return require(name);
      },
    });
    return exports;
  }
  return load;
}
const fields = loader()("lib/blog.ts");
const valid = { title: "A thoughtful beginning", slug: "a-thoughtful-beginning", excerpt: "Make it personal.", content: "## Begin with your story\n\nChoose a meaningful detail.", category: "Invitation guides", author: "Beyond Invitation", cover_image: "", cover_alt: "", featured: false, status: "draft" };
const id = "11111111-1111-4111-8111-111111111111";

test("blog validation supports incomplete drafts but requires publishable content", () => {
  assert.equal(fields.parseBlogInput({ ...valid, excerpt: "", content: "" }).status, "draft");
  assert.throws(() => fields.parseBlogInput({ ...valid, status: "published", excerpt: "" }), /introduction/);
  assert.throws(() => fields.parseBlogInput({ ...valid, status: "published", content: " " }), /content/);
  assert.throws(() => fields.parseBlogInput({ ...valid, slug: "Invalid URL" }), /slug/);
  assert.throws(() => fields.parseBlogInput({ ...valid, category: "anything" }), /category/);
  assert.throws(() => fields.parseBlogInput({ ...valid, title: "x".repeat(181) }), /180/);
  assert.throws(() => fields.parseBlogInput({ ...valid, featured: "false" }), /feature/);
  assert.throws(() => fields.parseBlogInput({ ...valid, cover_image: "https://example.test/photo.jpg" }), /description/);
  const post = fields.parseBlogInput({ ...valid, status: "published", author: "  Studio  ", id, created_at: "spoofed" });
  assert.equal(post.author, "Studio"); assert.equal(post.id, undefined); assert.equal(post.created_at, undefined);
});

test("slugs and image URLs reject active content and unsafe origins", () => {
  assert.equal(fields.blogSlug("  Café & Celebrations!  "), "cafe-celebrations");
  for (const value of ["javascript:alert(1)", "data:image/svg+xml,test", "//other.test/image.jpg", "/\\evil.test/x", "https://user:secret@example.test/x", "http://example.test/x", "https://example.test/<tag>"]) assert.equal(fields.safeBlogImage(value), false, value);
  assert.equal(fields.safeBlogImage("https://example.test/image.jpg?size=large"), true);
  assert.equal(fields.safeBlogImage("/category/hindu-wedding-cards.png"), true);
  assert.equal(fields.readingMinutes("word ".repeat(201)), 2);
  assert.equal(fields.readingMinutes("![a long description](https://example.test/x.jpg)"), 1);
});

test("request size checks apply without Content-Length and writes require the same origin", async () => {
  const { readBlogBody, checkBlogOrigin } = loader()("lib/admin/blog-request.ts");
  const request = new Request("https://shop.test/api/admin/blogs", { method: "POST", body: "x".repeat(40) });
  await assert.rejects(readBlogBody(request, 20), error => error.status === 413);
  assert.throws(() => checkBlogOrigin(new Request("https://shop.test/api/admin/blogs", { headers: { origin: "https://other.test" } })), error => error.status === 403);
  checkBlogOrigin(new Request("https://shop.test/api/admin/blogs", { headers: { origin: "https://shop.test" } }));
});

test("admin API rejects invalid JSON, cross-origin writes and oversized images before touching storage", async () => {
  let writes = 0;
  const load = loader({ "next/cache": { revalidatePath() {} }, "@/lib/admin/blog-service": { async saveBlog() { writes++; } } });
  const route = load("app/api/admin/blogs/route.ts");
  const req = (body, headers = {}) => new NextRequest("https://shop.test/api/admin/blogs", { method: "POST", body, headers: { "Content-Type": "application/json", Origin: "https://shop.test", ...headers } });
  assert.equal((await route.POST(req("{}", { Origin: "https://evil.test" }))).status, 403);
  assert.equal((await route.POST(req("invalid-json"))).status, 400);
  assert.equal((await route.POST(req("x".repeat(fields.BLOG_MAX_BODY + 1)))).status, 413);
  assert.equal(writes, 0);
  const images = loader({ "@/lib/admin/item-photo": { prepareItemPhoto() { throw new Error("Unexpected image decode"); } }, "@/lib/supabase/admin": { getSupabaseAdminClient() { throw new Error("Unexpected storage access"); } } })("app/api/admin/blogs/images/route.ts");
  assert.equal((await images.POST(req("x", { "Content-Type": "multipart/form-data; boundary=test", "Content-Length": String(fields.BLOG_IMAGE_BYTES * 2) }))).status, 413);
});

test("server-side publication owns timestamps, stable creation retries, and stale edit detection", async () => {
  const calls = [], queue = [];
  const db = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const builder = {
      select() { return builder; }, insert(value) { call.insert = value; return builder; }, update(value) { call.update = value; return builder; },
      eq(key, value) { call.filters.push([key, value]); return builder; }, abortSignal() { return builder; },
      async single() { return queue.shift(); }, async maybeSingle() { return queue.shift(); },
    }; return builder;
  } };
  const service = loader({ "@/lib/supabase/admin": { getSupabaseAdminClient: () => db } })("lib/admin/blog-service.ts");
  const record = { ...valid, id, reading_minutes: 1, created_at: "2026-09-22T00:00:00Z", updated_at: "2026-09-22T00:00:00Z", published_at: null };
  queue.push({ data: record, error: null });
  await service.saveBlog({ ...valid, id, published_at: "2000-01-01" }, false, AbortSignal.timeout(1000));
  assert.equal(calls[0].insert.published_at, null);
  queue.push({ error: { code: "23505", message: "duplicate" } }, { data: record });
  assert.equal((await service.saveBlog({ ...valid, id }, false, AbortSignal.timeout(1000))).post.id, id);
  queue.push({ data: record, error: null }, { data: null, error: null });
  await assert.rejects(service.saveBlog({ ...valid, id, expectedUpdatedAt: record.updated_at, title: "A changed story" }, true, AbortSignal.timeout(1000)), error => error.status === 409);
  assert.deepEqual(calls.at(-1).filters, [["id", id], ["updated_at", record.updated_at]]);
  queue.push({ data: record, error: null }, { data: { ...record, status: "published" }, error: null });
  await service.saveBlog({ ...valid, id, expectedUpdatedAt: record.updated_at, status: "published" }, true, AbortSignal.timeout(1000));
  assert.ok(calls.at(-1).update.published_at);
  assert.equal(calls.at(-1).update.reading_minutes, 1);
  assert.equal(calls.at(-1).update.created_at, undefined);
});

test("Markdown renders headings, tables and images while blocking raw HTML and active URLs", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const markdown = await import("react-markdown");
  const gfm = await import("remark-gfm");
  const Component = loader({ "react-markdown": { __esModule: true, ...markdown }, "remark-gfm": { __esModule: true, ...gfm } })("components/blog/BlogMarkdown.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Component, { content: "## A meaningful detail\n\n**Beautiful** and *personal*.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![Invitation](https://example.test/photo.jpg)\n\n![unsafe](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>" }));
  assert.match(html, /<h2>A meaningful detail<\/h2>/);
  assert.match(html, /<strong>Beautiful<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /alt="Invitation"/);
  assert.doesNotMatch(html, /<script|onerror|javascript:|src="x"/);
});

test("image pipeline decodes real raster bytes and refuses disguised or animated files", async () => {
  const sharp = require("sharp");
  const { prepareItemPhoto } = loader({ "@/lib/supabase/admin": {}, "./item-fields": { MAX_PRODUCT_PHOTO_BYTES: fields.BLOG_IMAGE_BYTES }, "./item-create": { ItemCreateError: fields.BlogError } })("lib/admin/item-photo.ts");
  const png = await sharp({ create: { width: 2300, height: 800, channels: 3, background: "#7b1c2e" } }).png().toBuffer();
  const prepared = await prepareItemPhoto(new File([png], "cover.png", { type: "image/png" }));
  const metadata = await sharp(prepared).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 1800);
  await assert.rejects(prepareItemPhoto(new File(["<svg><script>bad</script></svg>"], "fake.png", { type: "image/png" })), /valid JPG/);
});
