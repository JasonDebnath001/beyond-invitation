const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("blog migration keeps drafts private, denies customer writes and enforces valid publication", async t => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/20260922_blog_posts.sql"), "utf8"));
    await db.exec(`INSERT INTO blog_posts (title,slug,excerpt,content,category,status,published_at) VALUES
      ('Draft story','draft-story','','','Invitation guides','draft',null),
      ('Live story','live-story','A useful guide.','## Details','Invitation guides','published',now()-interval '1 hour'),
      ('Future story','future-story','Another guide.','## More','Invitation guides','published',now()+interval '1 day');`);
    await t.test("anonymous and authenticated readers only see published, non-future articles", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`SET ROLE ${role};`);
        assert.deepEqual((await db.query("SELECT slug FROM blog_posts")).rows.map(row => row.slug), ["live-story"]);
        assert.equal((await db.query("SELECT * FROM blog_posts WHERE slug='draft-story'")).rows.length, 0);
        await assert.rejects(db.exec("INSERT INTO blog_posts (title,slug,category) VALUES ('Bad','bad','Invitation guides')"), { code: "42501" });
        await assert.rejects(db.exec("UPDATE blog_posts SET status='draft'"), { code: "42501" });
        await assert.rejects(db.exec("DELETE FROM blog_posts"), { code: "42501" });
        await db.exec("RESET ROLE;");
      }
    });
    await t.test("service role can manage drafts while unique slugs and publish validation are enforced", async () => {
      await db.exec("SET ROLE service_role;");
      assert.equal((await db.query("SELECT * FROM blog_posts")).rows.length, 3);
      await assert.rejects(db.exec("UPDATE blog_posts SET status='published',published_at=now() WHERE slug='draft-story'"), { code: "23514" });
      await assert.rejects(db.exec("INSERT INTO blog_posts (title,slug,category) VALUES ('Copy','live-story','Invitation guides')"), { code: "23505" });
      await assert.rejects(db.exec("UPDATE blog_posts SET cover_image='https://example.test/image.jpg' WHERE slug='draft-story'"), { code: "23514" });
      const before = (await db.query("SELECT updated_at::text FROM blog_posts WHERE slug='live-story'")).rows[0].updated_at;
      await db.exec("UPDATE blog_posts SET title='Updated story' WHERE slug='live-story'");
      const after = (await db.query("SELECT updated_at::text FROM blog_posts WHERE slug='live-story'")).rows[0].updated_at;
      assert.notEqual(before, after);
      const stale = await db.query("UPDATE blog_posts SET title='Stale' WHERE slug='live-story' AND updated_at=$1 RETURNING id", [before]);
      assert.equal(stale.rows.length, 0);
      await db.exec("UPDATE blog_posts SET status='draft' WHERE slug='live-story'; RESET ROLE; SET ROLE anon;");
      assert.equal((await db.query("SELECT * FROM blog_posts")).rows.length, 0);
      await db.exec("RESET ROLE;");
    });
    await t.test("image bucket is public for delivery and limited to bounded WebP uploads", async () => {
      const bucket = (await db.query("SELECT * FROM storage.buckets WHERE id='blog_images'")).rows[0];
      assert.equal(bucket.public, true); assert.equal(Number(bucket.file_size_limit), 3145728);
      assert.deepEqual(bucket.allowed_mime_types, ["image/webp"]);
    });
  } finally { await db.close(); }
});
