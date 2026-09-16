# Website orders and Razorpay

Checkout now stores orders in Supabase, including guest orders. The order, verification and webhook routes no longer create ERPNext customers, Sales Orders or Payment Entries.

## Required setup

1. Run [migrations/20260916_website_orders.sql](migrations/20260916_website_orders.sql) **once** as the database owner in the SQL Editor of the Supabase project used by this website. It creates `public.website_orders`, its access policy and the backend payment-update function in one transaction. It does not require an existing orders table or change catalogue tables.
2. Under Supabase **Settings > API Keys**, copy a **secret key** into the server environment as `SUPABASE_SECRET_KEY`. A legacy `service_role` key is also supported through `SUPABASE_SERVICE_ROLE_KEY`. Use one of these, not the public/anon key. These credentials must never have a `NEXT_PUBLIC_` prefix. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
3. In Razorpay, configure the public HTTPS webhook URL `https://www.beyondinvitation.co.in/api/razorpay/webhook` for `payment.captured` and `order.paid`. Set the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`. Configure test and live modes separately; for local webhook testing use a public tunnel to the local server. Localhost itself is not reachable by Razorpay.
4. Use automatic capture in Razorpay, or capture authorized payments through your existing operational process. This application does not initiate capture. It marks an order paid only after the Payments API reports `captured`. See [Razorpay checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [webhooks](https://razorpay.com/docs/webhooks/).
5. Restart `npm run dev`. Set the same server variables in the hosting environment and redeploy for production.

```env
# Already used for the catalogue and account sessions:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-existing-public-key

# New: server-only order storage (or use SUPABASE_SERVICE_ROLE_KEY):
SUPABASE_SECRET_KEY=your-supabase-secret-key

NEXT_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

The public Supabase key cannot create tables or perform trusted payment writes. At implementation time, this workspace had only public Supabase credentials and no database-admin connection. **The migration has been tested locally, but has not been applied to the hosted project.** The Supabase secret key and Razorpay webhook secret still need to be configured.

## Stored data and access

`website_orders` contains one row per checkout attempt:

- `id`: UUID website order reference, also sent to Razorpay as the receipt and `notes.websiteOrderId`.
- `user_id`: verified Supabase Auth ID when signed in; null for guests. The checkout email never determines account ownership.
- Customer name, email, phone, shipping address and order notes.
- `items`: complete cart snapshot with `itemCode`, `name`, `basePrice`, `price` (INR per unit) and `quantity`. The prices come from the server's catalogue lookup.
- `amount_paise`, `currency`, optional referral code and commission in paise.
- Unique Razorpay order/payment IDs, `payment_status` (`pending` or `paid`), creation time and first payment-confirmation time.

RLS permits authenticated customers to read only their own rows. Public clients cannot insert, update or delete orders or call the payment-update function. Guests cannot query order rows. Writes use a separate server-only Supabase client without a customer's session and with uncached requests. Deleting an Auth user removes the account link while retaining the order record. See [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

The existing `/my-orders` page remains an order-help page. This change establishes order storage; it does not add an order-history interface or import legacy ERPNext orders. Contact-lead and referral integrations elsewhere in the repository still contain legacy ERPNext code.

## Payment flow and recovery

1. The server validates the customer and calculates the cart total from the Supabase catalogue.
2. It saves the full pending website order before creating a Razorpay order. Missing credentials/table or a failed insert stop checkout before Razorpay is called.
3. It creates a Razorpay order with the website reference, links that ID in Supabase, and only then returns the checkout details. A failed link never opens checkout. Failed/abandoned attempts can remain pending; a pending row is not proof of payment.
4. The browser callback verifies the Razorpay checkout signature. The server fetches the payment from Razorpay and compares the payment ID, order ID, amount and currency against the stored order.
5. Captured payments are recorded with `mark_website_order_paid`. The function locks the row, checks its amount/currency, prevents a different payment from replacing an existing payment, and preserves the first `paid_at` on repeated calls.
6. Authorized payments and temporary storage/API failures show **Payment confirmation pending** with the payment reference and instructions not to pay again. The webhook provides recovery if the browser closes or immediate confirmation fails.
7. The webhook verifies the exact raw-body signature before processing. It uses the same payment reconciliation and returns a non-2xx response on failure so Razorpay can retry.

The two systems do not share a transaction. A gateway creation/link failure can leave an unpaid pending row, and a paid notification can arrive while storage is unavailable. Monitor webhook delivery failures in Razorpay and replay failed deliveries after restoring service. Do not manually mark an order paid based only on a browser message. Refund, cancellation, inventory, invoicing and shipping workflows are not implemented by this migration.

Inspect the installation in the SQL Editor:

```sql
select relrowsecurity
from pg_class where oid = 'public.website_orders'::regclass;
-- true

select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'website_orders';
-- One SELECT policy for authenticated owners. No public write policies.

select id, payment_status, amount_paise, currency,
       razorpay_order_id, razorpay_payment_id, created_at, paid_at
from public.website_orders order by created_at desc limit 20;
```

## Validation

`npm test` covers guest and signed-in checkout, ignoring forged owners/totals, storage failure before Razorpay, link failures, signature rejection, payment association/amount/currency/capture checks, pending confirmation and webhook retries. The database tests apply the actual migration to disposable PostgreSQL through PGlite and exercise RLS, write restrictions, unique payment references, replay safety, database constraints and account deletion. Concurrent production connections and actual payments are not exercised by these tests.

After applying the migration and configuring the secrets, use Razorpay test mode to complete one guest checkout and one signed-in checkout. Confirm the saved cart/address, unique payment reference and `paid` status in Supabase. Redeliver the captured webhook and verify that it leaves the same order/payment/timestamp intact. Also test closing the browser after payment to confirm webhook recovery.
