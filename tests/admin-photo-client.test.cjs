const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(options = {}) {
  const exports = {};
  const draws = [], timers = new Map();
  let timerId = 0, closed = 0, decodes = 0;
  const bitmap = { width: 6000, height: 4000, ...options.dimensions, close() { closed++; } };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage(image, x, y, width, height) { assert.equal(image, bitmap); draws.push({ width, height }); } }),
    toBlob: (done, type, quality) => {
      assert.equal(type, "image/webp"); assert.equal(quality, 0.92);
      if (options.stallEncoding) return;
      done(options.encode ? options.encode(draws.length) : new Blob(["compressed"], { type: "image/webp" }));
    },
  };
  const filename = path.join(__dirname, "..", "lib/admin/item-photo-client.ts");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, File, Blob, Error,
    createImageBitmap: async (file, settings) => {
      decodes++; assert.equal(settings.imageOrientation, "from-image");
      return options.decode ? options.decode(bitmap) : bitmap;
    },
    document: { createElement(tag) { assert.equal(tag, "canvas"); return canvas; } },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      assert.equal(name, "./item-fields");
      return { MAX_PRODUCT_PHOTO_BYTES: 3 * 1024 * 1024, MAX_PRODUCT_PHOTO_SOURCE_BYTES: 20 * 1024 * 1024 };
    },
  });
  return { prepare: exports.prepareProductPhoto, draws, timers, bitmap, canvas, closed: () => closed, decodes: () => decodes };
}
const original = (size = 14 * 1024 * 1024, type = "image/jpeg") => new File([new Uint8Array(size)], "photo.jpg", { type, lastModified: 123 });

test("14 MB photos become small uploads with bounded dimensions, aspect ratio and original identity preserved", async () => {
  const f = fixture();
  const source = original();
  const result = await f.prepare(source);
  assert.equal(result.type, "image/webp");
  assert.equal(result.name, "photo.webp");
  assert.equal(result.lastModified, 123);
  assert.ok(result.size <= 3 * 1024 * 1024);
  assert.equal(source.size, 14 * 1024 * 1024);
  assert.deepEqual(f.draws, [{ width: 1800, height: 1200 }]);
  assert.equal(f.closed(), 1);
  assert.equal(f.canvas.width, 0);
  assert.equal(f.timers.size, 0);
});

test("portrait images keep their proportions and small originals avoid another encoding pass", async () => {
  const portrait = fixture({ dimensions: { width: 4000, height: 6000 } });
  await portrait.prepare(original());
  assert.deepEqual(portrait.draws, [{ width: 1200, height: 1800 }]);
  const small = fixture({ dimensions: { width: 300, height: 200 } });
  const source = original(1000);
  assert.equal(await small.prepare(source), source);
  assert.equal(small.draws.length, 0);
  assert.equal(small.closed(), 1);
});

test("PNG encoder fallback reduces dimensions until the upload fits", async () => {
  const f = fixture({ encode: attempt => new Blob([new Uint8Array(attempt === 1 ? 4 * 1024 * 1024 : 1000)], { type: "image/png" }) });
  const result = await f.prepare(original());
  assert.equal(result.name, "photo.png");
  assert.equal(result.type, "image/png");
  assert.deepEqual(f.draws, [{ width: 1800, height: 1200 }, { width: 1350, height: 900 }]);
  const oversized = fixture({ encode: () => new Blob([new Uint8Array(4 * 1024 * 1024)], { type: "image/webp" }) });
  await assert.rejects(oversized.prepare(original()), /could not be made small enough/);
  assert.equal(oversized.closed(), 1);
  assert.equal(oversized.timers.size, 0);
});

test("unsupported or oversized originals never decode; unreadable photos release their deadline", async () => {
  const f = fixture();
  for (const source of [original(0), original(20 * 1024 * 1024 + 1), original(100, "image/svg+xml")])
    await assert.rejects(f.prepare(source), /up to 20 MB/);
  assert.equal(f.decodes(), 0);
  const corrupt = fixture({ decode() { throw new Error("Invalid image"); } });
  await assert.rejects(corrupt.prepare(original(100)), /could not be read/);
  assert.equal(corrupt.timers.size, 0);
  const failedCanvas = fixture({ encode: () => null });
  await assert.rejects(failedCanvas.prepare(original()), /could not be read/);
  assert.equal(failedCanvas.closed(), 1);
});

test("cancelling a pending decode rejects promptly and closes the bitmap when it arrives", async () => {
  let finish;
  const f = fixture({ decode: bitmap => new Promise(resolve => { finish = () => resolve(bitmap); }) });
  const controller = new AbortController();
  const pending = f.prepare(original(), controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.closed(), 1);
  assert.equal(f.draws.length, 0);
  assert.equal(f.timers.size, 0);
});

test("stalled encoding times out and frees browser image memory", async () => {
  const f = fixture({ stallEncoding: true });
  const pending = f.prepare(original());
  await new Promise(resolve => setImmediate(resolve));
  for (const timer of f.timers.values()) { assert.equal(timer.ms, 30000); timer.fn(); }
  await assert.rejects(pending, /took too long/);
  assert.equal(f.closed(), 1);
  assert.equal(f.canvas.width, 0);
  assert.equal(f.timers.size, 0);
});
