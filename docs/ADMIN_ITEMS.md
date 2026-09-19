# Item dashboard

Open `/admin`. The item library reads live item records for the selected company, including disabled and non-website items. Search by design number, item code, Print Name, Item Category or Subject. Open an item to see every template field. CSV export and a blank CSV template are available.

The dashboard and `/api/admin/*` intentionally have **no authentication yet**, as requested. They are not linked from customer navigation or the sitemap. `/admin` has noindex metadata and a robots exclusion. These measures do not restrict access: anyone who knows the URL can read items and submit imports. Add the future admin permission check to both the page and every `/api/admin/*` route. Same-origin validation on import requests only addresses cross-site form submissions; it is not authentication.

## Upload and matching

- Accepts UTF-8 CSV and XLSX. Excel uploads read the `Data` worksheet, or the first visible worksheet when `Data` is absent. Hidden lists, notes and formula instructions are not executed. Formula/error cells are rejected.
- Supports all 52 columns in the supplied `Item_Template.xlsx`, plus optional `Image URL` and `Thumbnail URL` columns. Unknown columns containing data are rejected. Empty note columns are reported and ignored.
- Maximum 4 MB, 1,000 item rows. Split larger exports into batches with the same headers.
- **Item Name is the design number** (`items.name`). Match case-insensitively within the selected company; it is required on every row.
- Blank Record ID does not force a duplicate insertion. An existing design is updated. Supplied IDs and codes must agree with the design. Renaming an existing design through import is not supported.
- Missing designs are created with a stable UUID. A supplied Code is used; otherwise a stable, unique `WEB-…` code is generated. New items require Item Group and Item Type.
- Existing items receive only changed fields. Blank/missing cells preserve current values. Use the exact text `[clear]` to clear an optional, nullable field. Boolean columns accept Y/N, Yes/No, true/false or 1/0. `Disable = Y` means `is_active = false`.
- Dates accept YYYY-MM-DD or DD/MM/YYYY; Excel date cells are supported. Numeric zero and boolean false are preserved. Height/Width stay in **centimetres**, and Weight stays in grams, matching the item master.

## References and website details

Item Category resolves to `items.item_category_id → item_categories.id`. Subject resolves separately to `items.subject_id → subjects.id`. Category text is never silently copied into Subject, pluralised or inferred from a description.

Reference names resolve within the selected company or the shared company. Company-local matches take precedence. Ambiguous matches are rejected. Existing reference IDs are also accepted. Unit symbols are recognised.

When “Create missing categories and reference records” is enabled, missing item groups, categories, brands, subjects, seasons, KE / Bharat records and sample categories are created in the selected company. Their exact names appear in the preview. Suppliers, units, tax categories, selling price lists and variant templates must already exist because their setup requires additional information. New reference records remain if an individual item write later fails; the result identifies the failed item so it can be retried.

Print Name and Item Name remain separate. `Item Description (Web)` updates `web_description`; `Description` updates the general item description. The storefront continues to prefer Print Name and web description, with its existing fallbacks. `Website Price List` selects the selling list; this template contains no selling-price transaction amounts, so imports do not create selling-price rows. Gallery files, prices and fields absent from the upload are preserved. A successful import invalidates the catalogue cache.

The current public `v_web_products` view still does not expose Item Category. The admin dashboard reads it directly from the item master. `/collections/wedding-card-hindu` includes only products with Item Category exactly `Hindu Wedding Card`. `/collections/wedding-card-muslim` and `/collections/wedding-card-christian` both include only Item Category exactly `Wedding Card`. Their matching root paths without `/collections` redirect to these pages. The server-only membership lookup reads IDs of active, website-visible items and their category names, then loads product content and prices through the public view. `/wedding-cards` uses the same Item Category rules for its Hindu, Muslim and Christian filters. All keeps the wider wedding catalogue without duplicating the products shared by Muslim and Christian. Other collections retain their existing rules. Imports invalidate the shared `catalogue` cache, including this category lookup.

## Preview, commit and recovery

1. Choose a company and file, then select **Preview changes**. Preview is read-only.
2. Inspect new/changed/unchanged/invalid counts, proposed reference creations, and field-level before/after values.
3. **Import ready rows** writes valid new or changed rows only. Invalid rows are explicitly skipped. Results include per-row created/updated/unchanged/skipped/failed status and can be downloaded as CSV.

Previews are signed on the server and expire after 30 minutes. Commit rereads the database and rebuilds the plan; changing the file, options or affected database records requires a new preview. Item updates additionally check the stored timestamp, preventing overwrites of concurrent edits. Stable insert IDs prevent simultaneous importer submissions from duplicating the same new design. Database constraints remain the final enforcement for item codes and references.

Writes are per item, **not one transaction for the entire file**. On a network interruption or partial failure, preview the same file again. Completed items should be unchanged and failed rows can be retried. Never assume that cancelling a request rolls back already completed writes. No item deletion is performed.

## Configuration and verification

Uses the existing `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`). Credentials stay on the server. No database migration is required. Writes use the existing item and reference tables.

Routes: `GET /api/admin/items?companyId=…`, `POST /api/admin/items/import` with multipart `file`, `companyId`, `createMissing`, `action=preview|commit`, and the preview `token` on commit.

Run `node --test tests/admin-items.test.cjs` and `npx tsc --noEmit --incremental false`. Tests use an isolated fake database and do not modify live inventory.

Read-only preview of the supplied template on 19 September 2026 recognised 52 columns and 53 item rows: 52 updates and one invalid row. Row 2 names AC-590 but carries AC-114's record ID and code IT1631. Correct or clear **both** stale identifiers before importing AC-590. The file proposes the new category names `Wedding Card` and `Hindu Wedding Card`; the existing `Wedding Cards` name remains a separate reference. No rows from this file were committed during implementation.
