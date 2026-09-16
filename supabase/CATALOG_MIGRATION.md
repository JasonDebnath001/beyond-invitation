# Product catalogue migration — 2026-09-14

The storefront catalogue now reads Supabase `public.v_web_products`. Listings, product detail, collection pages, search and sitemap use the shared data layer in `lib/catalog.ts`. The route formerly at `/erp-products` is now `/catalog`.

The public view returned **158 products**, **31 with a price**, during verification. `/products/535093` keeps its design-number URL and currently displays **Price on request** with a link to `/contact?product=535093`. Checkout rejects unpriced lines, including mixed carts containing a priced item. Unpriced products do not publish zero-price SEO offers.

## Data contract and implementation choices

- The final SQL is [migrations/20260914_web_catalog.sql](migrations/20260914_web_catalog.sql). The user ran this migration successfully before storefront work began. No further database changes were made in Part 2.
- `brand_name` and the brand-table join were omitted at the user's request. Product brand metadata uses `BRAND_NAME` from `lib/site-config.ts`.
- Only the anon/publishable key is used. The client is server-only and initialized lazily. The view is the only Supabase relation queried by the app.
- Base product data is cached for 60 seconds and shared by list, detail and search reads. React request caching also deduplicates concurrent page/metadata reads. Reseller pricing stays outside this cache and retains the existing margin functions.
- Prices must be positive and finite to permit online purchase. SQL NULL becomes zero with `hasPrice: false`; MRP NULL becomes zero in the Product shape.
- Millimetre and gram fields are mapped directly. Product detail labels now show millimetres for lengths.
- Existing quantity rules remain in force. `minOrderQty` and `orderMultiple` are available as catalogue metadata; this migration does not replace the storefront's existing quantity rules.
- Collection matching uses Subject, not supplier/year groups. The broad wedding collection uses the four wedding-card subjects. Religious collections retain their existing inclusion of the shared Wedding Card subject. Wedding boxes use the seeded Wedding Box subject.
- Current language and unassigned subjects stay visible in all-product lists and search. The empty collection states are expected until subjects are changed in Samriddhi.
- Local product fixtures are retained on disk but are no longer merged into listings, detail, search or sitemap.
- The SQL keeps the previously documented choices: existing subject ID defaults, active tags only, and latest `effective_from` as a price tie-breaker. It does not add an effective-from start-date filter.

## Verification

- `npm run lint`: passed. Existing warnings remain for native image elements and a wishlist hook dependency; `next lint` also prints its Next.js 16 deprecation notice. ESLint dependencies and configuration were added because the repository previously lacked a runnable lint setup.
- `npm test`: **20 passed**, including all eight retained gallery regression tests. New tests cover mapping, null prices, primary image ordering, deduplication, category fallback, slug identity, metadata, exact subject matching, pagination, shared base caching, reseller pricing and checkout rejection.
- `npm run build`: passed.
- `npx tsc --noEmit --incremental false`: passed independently of the existing build configuration that skips type validation.
- Remaining `erpnext` references in app/components/lib are confined to the retained integration and order, customer, contact, wishlist and reseller paths.

With `npm run dev`, HTTP responses and parsed server-rendered HTML were checked:

| Route/check | Result |
| --- | --- |
| `/` | 200; live catalogue content |
| `/catalog` | 200; 158 distinct product links |
| `/collections/wedding` | 200; empty state |
| `/collections/wedding-card-hindu` | 200; empty state |
| Wedding Card, Muslim, Christian and Shagun collection pages | 200; empty states |
| `/wedding-cards`, `/wedding-boxes` | 200 |
| `/products/535093` | 200; Price on request, contact link, no purchase buttons or zero-price offer |
| `/products/313082` | 200; priced product with Add to Cart |
| `/search?q=535`, `/api/search?q=535` | 200; 69 matches including 535093 |
| `/sitemap.xml` | 200; 158 unique product URLs and the catalogue route |
| 535093 primary Supabase storage image | 200; nonempty image response |
| Next.js image optimizer with that Supabase URL | 200; image response |

No browser connection was available, so visual and interactive browser QA could not be performed. No real orders, payments or wishlist records were created during verification. Their integrations were preserved and compiled; checkout pricing was tested without external writes.

## Files changed

```text
.eslintrc.json                         added
README.md
package.json
package-lock.json
next.config.js
types/index.ts
lib/catalog.ts                        added
lib/supabase/server.ts                added
lib/products.ts
lib/checkout.ts
lib/erp-wishlist.ts                    product lookup import only
lib/product-quantity.ts               comment only
lib/seo.ts
app/catalog/page.tsx                  replaces app/erp-products/page.tsx
app/page.tsx
app/products/[slug]/page.tsx
app/collections/[category]/page.tsx
app/collections/wedding-card/page.tsx
app/collections/wedding-card-hindu/page.tsx
app/collections/wedding-card-muslim/page.tsx
app/collections/wedding-card-christian/page.tsx
app/collections/shagun-envelopes/page.tsx
app/wedding-cards/page.tsx
app/wedding-boxes/page.tsx
app/sitemap.ts
app/api/search/route.ts               comment only
components/AddToCartButton.tsx
components/ProductBuyBox.tsx
components/ProductPrice.tsx
components/ProductCard.tsx
components/ProductGallery.tsx
components/ImageSlider.tsx
components/CategoryCollectionPage.tsx
components/CollectionPageShell.tsx
components/WeddingBoxesPageClient.tsx
tests/catalog-mapper.test.cjs          added
supabase/migrations/20260914_web_catalog.sql  added in Part 1
supabase/CATALOG_MIGRATION.md          this report
```

`lib/erpnext.ts`, `lib/reseller.ts`, Razorpay handlers, the then-current authentication middleware, wishlist-record operations and category definitions were preserved. Environment files were not edited.


## Guest storefront update ? 2026-09-16

Authentication has since been removed. Wishlist selections now persist on the current device and resolve product details through the Supabase catalogue. The old ERP wishlist module and API have been retired. Account/order-help and reseller-enquiry pages are public; private order history and reseller self-service are not exposed. Guest payment verification retains signature validation. No Supabase schema change is required for these guest wishlist selections.

Validation for the guest update: 27 automated tests passed, lint passed with existing image warnings, the production build passed, and TypeScript passed independently. HTTP checks confirmed public catalogue, wishlist, checkout, account-help, order-help and reseller-enquiry pages; live wishlist lookups returned Supabase products. Invalid payment inputs and retired reseller operations were rejected. No real payments or orders were created.
