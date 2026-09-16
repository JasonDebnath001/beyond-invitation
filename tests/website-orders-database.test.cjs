const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

test("website orders migration protects checkout snapshots and records payments idempotently", async (t) => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${alice}'), ('${bob}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    `);
    await db.exec(readFileSync(path.join(__dirname, "../supabase/migrations/20260916_website_orders.sql"), "utf8"));
    async function role(name, id = "") {
      await db.exec(`RESET ROLE; SET ROLE ${name};`);
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
    }
    async function insert(userId, orderId) {
      return (await db.query(`INSERT INTO public.website_orders
        (user_id, customer_name, customer_email, customer_phone, shipping_address, items, amount_paise, razorpay_order_id)
        VALUES ($1, 'Buyer', 'buyer@example.test', '1234567890', '{"city":"Delhi"}',
          '[{"itemCode":"CARD1","name":"Invitation","price":100,"basePrice":100,"quantity":50}]', 500000, $2)
        RETURNING id`, [userId, orderId])).rows[0].id;
    }
    const pay = (orderId, paymentId, amount = 500000, currency = "INR") => db.query(
      "SELECT public.mark_website_order_paid($1, $2, $3, $4)", [orderId, paymentId, amount, currency],
    );
    let ownId;
    await t.test("server can create both guest and signed-in order snapshots", async () => {
      await role("service_role");
      ownId = await insert(alice, "order_alice");
      await insert(null, "order_guest");
      await insert(bob, "order_bob");
      assert.equal((await db.query("SELECT * FROM public.website_orders")).rows.length, 3);
    });
    await t.test("public clients cannot read guest orders, forge orders, or mark anything paid", async () => {
      await role("anon");
      await assert.rejects(db.query("SELECT * FROM public.website_orders"), { code: "42501" });
      await assert.rejects(insert(null, "order_fake"), { code: "42501" });
      await assert.rejects(pay("order_alice", "pay_fake"), { code: "42501" });
      await role("authenticated", alice);
      assert.deepEqual((await db.query("SELECT id FROM public.website_orders")).rows, [{ id: ownId }]);
      await assert.rejects(insert(alice, "order_fake"), { code: "42501" });
      await assert.rejects(db.query("UPDATE public.website_orders SET amount_paise = 100"), { code: "42501" });
      await assert.rejects(db.query("DELETE FROM public.website_orders"), { code: "42501" });
      await assert.rejects(pay("order_alice", "pay_fake"), { code: "42501" });
      await role("authenticated", bob);
      assert.equal((await db.query("SELECT id FROM public.website_orders WHERE id = $1", [ownId])).rows.length, 0);
    });
    await t.test("payment updates reject unknown orders, wrong totals, currencies and missing IDs", async () => {
      await role("service_role");
      for (const args of [["order_missing", "pay_alice"], ["order_alice", "pay_alice", 100],
        ["order_alice", "pay_alice", 500000, "USD"], ["order_alice", null], ["order_alice", "invalid"]]) {
        await assert.rejects(pay(...args), { code: "P0001" });
      }
      assert.equal((await db.query("SELECT payment_status FROM public.website_orders WHERE id = $1", [ownId])).rows[0].payment_status, "pending");
    });
    await t.test("browser and webhook replay preserves one payment and its first paid timestamp", async () => {
      await pay("order_alice", "pay_alice");
      const before = (await db.query("SELECT * FROM public.website_orders WHERE id = $1", [ownId])).rows[0];
      await pay("order_alice", "pay_alice");
      const after = (await db.query("SELECT * FROM public.website_orders WHERE id = $1", [ownId])).rows[0];
      assert.deepEqual(after, before);
      assert.equal(after.payment_status, "paid");
      assert.equal(after.razorpay_payment_id, "pay_alice");
      await assert.rejects(pay("order_alice", "pay_different"), { code: "P0001" });
      await assert.rejects(pay("order_guest", "pay_alice"), { code: "23505" });
      await pay("order_guest", "pay_guest");
    });
    await t.test("unique gateway references and valid totals are database constraints", async () => {
      await assert.rejects(insert(null, "order_alice"), { code: "23505" });
      await assert.rejects(db.query("UPDATE public.website_orders SET amount_paise = 0 WHERE id = $1", [ownId]), { code: "23514" });
      await assert.rejects(db.query("UPDATE public.website_orders SET items = '[]' WHERE id = $1", [ownId]), { code: "23514" });
    });
    await t.test("account deletion retains paid orders but removes account access", async () => {
      await db.exec("RESET ROLE");
      await db.query("DELETE FROM auth.users WHERE id = $1", [alice]);
      const saved = (await db.query("SELECT user_id, payment_status FROM public.website_orders WHERE id = $1", [ownId])).rows[0];
      assert.deepEqual(saved, { user_id: null, payment_status: "paid" });
    });
  } finally { await db.close(); }
});
