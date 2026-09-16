const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

test("wishlist migration enforces ownership, publication, uniqueness, limits and account cleanup in PostgreSQL", async (t) => {
  // Disposable PostgreSQL with the same roles/Auth identity contract as Supabase.
  // No real Supabase project or customer data is accessed.
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${alice}'), ('${bob}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      CREATE TABLE public.catalog_fixture (slug text PRIMARY KEY);
      INSERT INTO public.catalog_fixture SELECT 'product-' || n FROM generate_series(1, 501) n;
      CREATE VIEW public.v_web_products AS SELECT slug FROM public.catalog_fixture;
      GRANT SELECT ON public.v_web_products TO anon, authenticated;
    `);
    await db.exec(readFileSync(path.join(__dirname, "../supabase/migrations/20260916_wishlist.sql"), "utf8"));
    async function asUser(id) {
      await db.exec("RESET ROLE; SET ROLE authenticated;");
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    }
    const count = async () => Number((await db.query("SELECT count(*) FROM public.wishlist_items")).rows[0].count);

    await t.test("anonymous clients cannot read or write wishlists", async () => {
      await db.exec("SET ROLE anon;");
      await assert.rejects(db.query("SELECT * FROM public.wishlist_items"), { code: "42501" });
      await assert.rejects(db.query("INSERT INTO public.wishlist_items VALUES ($1, 'product-1')", [alice]), { code: "42501" });
    });
    await t.test("owners can add once; other users cannot read, insert or delete their rows", async () => {
      await asUser(alice);
      await db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'product-1') ON CONFLICT DO NOTHING", [alice]);
      await db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'product-1') ON CONFLICT DO NOTHING", [alice]);
      assert.equal(await count(), 1);
      await asUser(bob);
      assert.equal(await count(), 0);
      const deleted = await db.query("DELETE FROM public.wishlist_items WHERE user_id = $1 RETURNING *", [alice]);
      assert.equal(deleted.rows.length, 0);
      await assert.rejects(db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'product-2')", [alice]), { code: "42501" });
      await assert.rejects(db.query("UPDATE public.wishlist_items SET user_id = $1", [bob]), { code: "42501" });
      await asUser(alice);
      assert.equal(await count(), 1);
    });
    await t.test("unpublished products cannot be added but existing saved items remain removable", async () => {
      await assert.rejects(db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'missing')", [alice]), { code: "42501" });
      await db.exec("RESET ROLE; DELETE FROM public.catalog_fixture WHERE slug = 'product-1';");
      await asUser(alice);
      assert.equal(await count(), 1);
      await db.query("DELETE FROM public.wishlist_items WHERE product_slug = 'product-1'");
      assert.equal(await count(), 0);
    });
    await t.test("database enforces the 500-item limit without blocking duplicate saves", async () => {
      await db.query("INSERT INTO public.wishlist_items (user_id, product_slug) SELECT $1, 'product-' || n FROM generate_series(2, 501) n", [alice]);
      assert.equal(await count(), 500);
      await db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'product-2') ON CONFLICT DO NOTHING", [alice]);
      await db.exec("RESET ROLE; INSERT INTO public.catalog_fixture VALUES ('overflow');");
      await asUser(alice);
      await assert.rejects(db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'overflow')", [alice]), { code: "P0001" });
      await db.query("DELETE FROM public.wishlist_items WHERE product_slug = 'product-2'");
      await db.query("INSERT INTO public.wishlist_items (user_id, product_slug) VALUES ($1, 'overflow')", [alice]);
      assert.equal(await count(), 500);
    });
    await t.test("deleting an Auth user cascades to their wishlist", async () => {
      await db.exec("RESET ROLE;");
      await db.query("DELETE FROM auth.users WHERE id = $1", [alice]);
      assert.equal(await count(), 0);
    });
  } finally { await db.close(); }
});
