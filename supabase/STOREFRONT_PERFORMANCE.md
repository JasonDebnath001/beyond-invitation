# Storefront performance: Stage 2

Stage 2 limits catalogue and collection responses to 24 products, applies filters
and sorting before pagination, and fetches subsequent pages on demand. The
homepage keeps its existing 10-product page size. Product detail and related
products use targeted reads. Collection cards receive summary fields rather than
full descriptions and galleries.

## Apply the database migration

Run [migrations/20261012_storefront_products.sql](migrations/20261012_storefront_products.sql)
in the Supabase SQL editor as the project database owner, after the existing
catalogue migration. The script creates:

- `public.v_storefront_products`: published product fields with resolved website
  titles, Selling prices and item categories.
- `public.storefront_product_page`: one paged query with totals, ordering and
  optional wedding filter counts.

The migration leaves the shared `v_web_products` view and base-table access rules
unchanged. It grants public read access only to the new storefront view and page
function. Existing Active/Draft pricing selection, quantity rules, category
membership and referral rounding are preserved.

The script has been tested against local PostgreSQL fixtures using PGlite. It has
**not been applied to the hosted Supabase database** by this implementation.

After applying it, verify the public query contract:

```sql
BEGIN;
SET LOCAL ROLE anon;
SELECT public.storefront_product_page(p_limit => 24);
ROLLBACK;
```

The result should contain `products`, `total` and `nextOffset`. A page with more
matches should contain 24 products and `nextOffset: 24`. Compare a known product's
title and price with its current storefront entry, then check catalogue Load More,
collection filters, and a referral-priced session.

## Rollout and cache behavior

The application can run before the migration: missing schema objects trigger
the previous catalogue reader. Pagination and media improvements still work, but
the consolidated database read requires the migration. Permission and network
errors are surfaced rather than silently falling back.

Base data is cached for 60 seconds with the existing `catalogue` tag. Referral
cookies are read outside the cache, and displayed prices are applied afterward.
For price-dependent filtering and ordering, the numeric margin is part of the
page cache key; cached product values retain base prices.

A missing migration is retried after 60 seconds. The enclosing page cache also
revalidates, so switching to the new query may take multiple refresh cycles.
Existing admin catalogue mutations invalidate the same tag. Monitor server logs
for the missing-migration warning and query errors during rollout.

## Rendering and media

- Wedding filters use totals and facet counts for the full collection, including
  products outside the loaded page. Aborted requests cannot replace newer results.
- Editorial images use responsive ImageKit variants with an original-image
  fallback.
- Instagram requests and review video sources wait until their sections approach
  the viewport. Category cards no longer wait through staggered reveal animations.

## Validation and limits

Use `npm test` and `npx tsc --noEmit --incremental false` for routine validation.
Regression tests cover SQL pricing parity, pagination, referral boundaries,
filter counts, request races, cache isolation and deferred media. A production
build is not required for each change.

Implementation checks: 152 tests passed, TypeScript passed, and lint passed with
native-image warnings. No production build was run for Stage 2.

The page query bounds the database response; computing totals, prices and sorts
still examines the matching catalogue in PostgreSQL. Actual hosted query timings
and browser performance should be measured after applying the migration and
deploying. Automated DOM tests do not replace visual browser QA.

## Product detail photo delivery

Detail galleries opt into [Supabase image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations)
for public Supabase photos. This avoids downloading a large original through the
application server for every cold Next.js image variant. Responsive widths use
`resize=contain` to preserve the full invitation and stay within Supabase's
2500-pixel parameter limit. Other image hosts keep the existing image loader.
If a storage transformation fails, the photo retries through Next's optimizer,
then the original URL, before showing the missing-photo state.

After the active photo loads, the gallery prepares one adjacent photo at low
priority. Thumbnail hover/focus can prepare a chosen photo using the same
responsive URL set. Optional downloads are skipped for data saver and 2G
connections. Desktop zoom requests at most 2000px and keeps the active photo
visible while that image loads.

On the development machine, `414041y` had an 11.38 MB original. A cold Next.js
1200px request took 4.63 seconds; a direct 1200px, quality-80 storage transform
took 0.94 seconds and returned 173 KB. A second product, `ac-538`, had a 9.54 MB
original and a 225 KB transformed photo. These are diagnostic samples, not
production performance guarantees. No stored originals or database rows were
modified by this change, and no additional SQL migration is required.

Photo-delivery checks: 20 focused image/gallery/detail tests, TypeScript and
targeted lint passed. The local product page returned HTTP 200 with transformed
main/thumbnail URLs and a matching responsive preload. No production build ran.

## Product card galleries

The wider, frameless card grids use responsive square photos and the same storage
transform fallback as the detail gallery. Collection pages still send only the
first image plus the full photo count. The first arrow click requests
`/api/catalog/products/[slug]/images`, which reuses the cached public single-product
lookup; rendering or hovering a card does not fetch its gallery. Further arrow
clicks reuse those URLs and render only the selected photo. Gallery changes abort
pending requests, failures preserve the current photo, and valid empty results
replace stale photos with a placeholder.

## Navigation feedback and public page latency

Catalogue, collection, wedding card and wedding box routes now have native Next
loading boundaries with a shared 12-card skeleton. Other destinations inherit a
generic loading screen; product details retain their existing tailored skeleton.
These boundaries let the destination start rendering while its data is pending.

Navigation links in the header, footer and product cards use Next's
`useLinkStatus` to show an accessible "Opening page" notice while navigation is
pending. The notice is outside the mobile menu so closing the menu does not hide
it. Search uses the same notice tied to its React navigation transition. Links
retain native prefetching, browser modifiers and cancellation behavior; there is
no timer-based progress simulation.

Middleware skips remote auth refresh only for an explicit allowlist of public
catalogue/content pages that render without a user session. Referral processing
still runs on those paths. Account, auth, checkout and unknown routes retain the
previous refresh behavior; private pages and APIs still validate identity on the
server. The browser's auth provider continues maintaining the public-page session.

On localhost, route compilation remains a separate cost: Next's automatic link
prefetching is enabled in production, and `next dev` compiles routes on demand.
Observed compile spans reached 3.2 seconds; the reported 10–20 second delay was
not reproduced in the diagnostic HTTP requests. After compilation, sampled
catalogue/collection responses began in 202–386ms and completed in 405–495ms.
These local HTTP checks are not a browser navigation benchmark. Route-streaming,
navigation-feedback and middleware tests passed, as did TypeScript and targeted
lint. No production build was run.
