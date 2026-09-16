# Supabase wishlist

## Create the table before deploying

Run [migrations/20260916_wishlist.sql](migrations/20260916_wishlist.sql) once in the **SQL Editor** of the same Supabase project used for Auth and `public.v_web_products`. Run it as the database owner. The existing catalogue migration must already be applied.

The migration creates `public.wishlist_items`, its policies and its limit trigger inside one transaction. It does not modify catalogue/ERP tables or Auth configuration. It is a one-time migration; do not rerun it after a successful commit.

Only the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are needed by the application. No service-role key is used. Public credentials cannot execute schema migrations: this migration has been validated locally but has **not** been applied to the hosted project from this workspace.

Verify installation in the SQL Editor:

```sql
select relrowsecurity
from pg_class
where oid = 'public.wishlist_items'::regclass;
-- Expected: true

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'wishlist_items';
-- Expected: SELECT, INSERT and DELETE policies for authenticated.
```

## Storage and authorization

- `user_id`: Supabase Auth UUID, referencing `auth.users(id)` with cascading deletion.
- `product_slug`: the existing storefront/catalogue slug, 1–200 characters.
- `created_at`: when the item was saved.
- Composite primary key `(user_id, product_slug)` prevents duplicate saves.
- Row-level security permits authenticated users to read, insert and delete only their own rows. Anonymous users have no table access. Updates are deliberately not granted.
- Insert policies require a currently published product in `v_web_products`. Unpublished saved products remain visible as unavailable on the wishlist page and can still be removed.
- An invoker-rights trigger enforces 500 items per account, serializing concurrent additions with a transaction-scoped advisory lock. The primary key supports owner-filtered reads and deletes without an additional index.

Slugs preserve the current product URL/storage contract and avoid granting access to ERP base tables. If a design is renamed and its slug changes, the old saved slug appears unavailable; this migration does not rewrite historical slugs.

Policies follow the [Supabase ownership/RLS pattern](https://supabase.com/docs/guides/database/postgres/row-level-security). Account data uses the request-scoped Auth client, never the cached public catalogue client.

## Application behavior

- Guests can still use hearts and the wishlist without signing in. Their selections remain under `beyond-invitation-wishlist-v1` in local storage, with memory-only fallback when storage is unavailable.
- After sign-in, the provider reads the account wishlist, merges published guest selections without duplicates, and clears successfully processed device entries only after the server confirms success. Unavailable guest products are omitted. Items beyond the account limit remain on the device and a retry message is displayed.
- Signed-in changes persist in Supabase. The header count, product-card hearts, product-detail heart and wishlist page share the same state. Failed writes restore the previous selection and display an error.
- Same-browser tabs notify one another via a storage event. Returning focus to a page refreshes its account wishlist, including changes made on another device. Supabase Realtime is not required; background pages do not continuously stream updates.
- Sign-out or account switching immediately hides the previous account's data. Account slugs are never copied to guest storage. Requests carry an expected account ID, but authorization always comes from `auth.getUser()` plus RLS; stale requests are rejected and stale responses ignored.
- The wishlist page links guests to `/sign-in?next=%2Fwishlist`.

## API

All `/api/wishlist` responses use `Cache-Control: private, no-store` and require a verified session. JSON writes enforce same-origin requests when an Origin header is present.

| Method | Body | Result |
| --- | --- | --- |
| `GET /api/wishlist` | — | `{ userId, slugs }` |
| `POST /api/wishlist` | `{ "slug": "313082" }` | Idempotently save one published product |
| `POST /api/wishlist` | `{ "slugs": ["313082"] }` | Merge guest items; return `{ userId, slugs, unmergedSlugs }` |
| `DELETE /api/wishlist` | `{ "slug": "313082" }` | Idempotently remove an item; return `{ userId, slugs }` |
| `POST /api/wishlist/products` | `{ "slugs": ["313082"] }` | Public current product details and applicable referral pricing |

The public product-resolution endpoint does not expose any stored account wishlist. Supplied `user_id` values never choose the owner of a write.

## Verification

`npm test` includes API ownership/input/error checks, React state tests for merging, failed writes, tab refresh, sign-out and stale responses, and guest-shopping regressions. `tests/wishlist-database.test.cjs` applies the actual migration to disposable PostgreSQL via PGlite and verifies anonymous denial, user isolation, duplicate prevention, publication checks, deletion, capacity and account-deletion cleanup. This does not access production customer data or test simultaneous database connections.

Validation on 2026-09-16: all 48 tests passed, independent TypeScript checking passed, lint passed with existing image warnings, and the production build passed. Local HTTP checks confirmed authenticated endpoints reject guests with uncached 401 responses, public wishlist product resolution returns live Supabase data, and wishlist/product pages render successfully. The development server is running on port 3000. Visual browser QA was unavailable because no browser was connected.

After applying the migration, sign in on two browsers with the same account, save and remove a product, and refocus the other browser to confirm it updates. Sign out and verify the account list disappears, then sign in with another account and verify it cannot see the first account's items. Also test guest-to-account merging. Live signed-in verification remains a deployment check because no database-admin connection or authenticated browser was available in this workspace.

Existing ERPNext wishlist records are not imported: no mapping from old ERP identities to new Supabase Auth UUIDs was provided. Existing device selections are migrated automatically as described above.
