# Item dashboard

Open `/admin`. The item library reads live item records for the selected company, including disabled and non-website items. Search by design number, item code, Print Name, Item Category or Subject. Each row shows its main photo and an **Edit** button. CSV export and a blank CSV template are available.

The library initially loads compact item summaries. Full editable fields, reference options and the selected item's gallery load when opening the editor; CSV data loads when exporting. Read requests have a 12-second server deadline and a 15-second client deadline, including response-body loading. A failed or stalled request stops the spinner and offers **Retry**. Refreshing cancels the previous library request so an older response cannot replace newer results.

The dashboard and `/api/admin/*` intentionally have **no authentication yet**, as requested. They are not linked from customer navigation or the sitemap. `/admin` has noindex metadata and a robots exclusion. These measures do not restrict access: anyone who knows the URL can read, create and edit items, upload product photos and submit imports. Add the future admin permission check to both the page and every `/api/admin/*` route. Same-origin validation on write requests only addresses cross-site submissions; it is not authentication.

## Add missing photos and details to existing items

1. Use **Missing main photo**, **Missing description**, **Missing category** or **Missing print name** to find items needing attention.
2. Click the item's photo, design number or **Edit** button. The editor opens with its current values.
3. Choose **Add photos** and select multiple JPG, PNG or WebP files together (up to 20 photos, 20 MB each, including 14 MB originals). The browser prepares them one at a time, automatically resizing large images for the website while preserving their proportions and orientation. Original files stay unchanged. Existing gallery photos stay visible alongside the prepared previews. You can add more files or remove individual queued photos before saving. Public links for the main photo and thumbnail remain editable under **Main photo and thumbnail links**.
4. Use **Product video** to upload an MP4/WebM file or paste a video link. Fill in or correct the other details. Expand **More item details** for dimensions, stock, tax, units and variants.
5. Select **Save changes**. Item details save first, then each selected photo uploads with progress. New photos are appended to the gallery. The current main photo is preserved; if it is missing, the first successful upload becomes the main photo and thumbnail. The library refreshes and the storefront catalogue cache is invalidated.

If some uploads fail, completed photos and item details remain saved. The editor marks each file and offers **Retry remaining photos**, reusing the same upload IDs so a retry cannot duplicate gallery entries. Details already saved stay locked during photo recovery. You can remove failed files and select **Finish**, or close the editor and keep everything already saved. Closing after a partial save refreshes the library.

To replace a photo, choose **Replace** under its existing preview and select a JPG, PNG or WebP file. Each selected replacement appears in the queue and can be cancelled before saving. **Save changes** uploads it, updates the existing gallery entry in place and, for the main photo, updates the item's main image and thumbnail. Gallery sort order and numbered filename positions are preserved. Main-photo link fields are locked while a main-photo replacement is queued.

After the replacement is saved, the old image and thumbnail objects are deleted from this project's Supabase `item_images` bucket. Files referenced by another item are retained; external image links are replaced without attempting to delete files on another host. Storage errors leave the replacement queued for **Retry remaining photos**. An attempted replacement cannot be removed from the queue, because its retry may still need to finish deleting old files. Keep the editor open and retry until the save finishes.

The editor sends only changed fields. Existing values, including inactive reference assignments and unrelated legacy values, stay untouched. Clearing a populated optional field explicitly clears it; required item fields cannot be cleared. The design number stays read-only. Updates check the item's ID, company and last-updated timestamp, so another person's newer edits are not overwritten.

Photos use the existing public Supabase `item_images` bucket, under a stable `dashboard/<company>/<item>/<upload-id>.webp` path. The server decodes and validates the image, applies orientation, strips metadata, and resizes to a maximum of 1,800 pixels. Each photo creates an `item_images` row with the same upload ID, company/item IDs and the next gallery sort order. Existing photos and gallery rows are preserved. Storage writes do not overwrite files. Retrying after a lost response reuses the saved gallery row or completes the missing database write. An upload abandoned after a database failure can leave an unattached storage object. No bucket or database migration is required.

The editor sends each photo in a separate request to keep upload bodies small even when the combined selection exceeds 3 MB. `POST /api/admin/items/photos` accepts multipart `companyId`, `itemId`, `uploadId` (UUIDs) and `photo`. It verifies that the company is active and the item belongs to it, adds a photo idempotently and returns `{ id, url }` with HTTP 201. Other companies' upload IDs and deleted gallery rows cannot be reused. Successful changes invalidate the catalogue cache, including partial progress recovered by retries.

The same endpoint accepts an optional `replaceUrl` identifying an existing main or gallery photo on that item. Replacement requests use the stable upload ID for retries and conditional URL matches to avoid overwriting a photo that changed in the meantime. Temporarily deleted `item_images` rows record the original image and thumbnail URLs before the references change. Cleanup uses those server-read URLs, checks remaining references, deletes storage objects and then removes the temporary rows. A retry after a lost response completes cleanup without adding gallery entries. No migration is required.

The 20 MB selection limit is separate from the 3 MB server upload limit. Before uploading, the browser fits large originals within 1,800 pixels, encodes WebP at quality 0.92, and checks the result against the upload limit. Browsers that fall back to PNG reduce dimensions further if needed. Small originals already within the byte and dimension limits avoid this extra encoding pass. Preparation has progress, cancellation and a 30-second deadline per photo; successful photos stay queued if another cannot be prepared. The queue retains prepared files, original display names and selection identities, so repeated selections are deduplicated and upload retries reuse the same prepared bytes and upload IDs. Server image validation and the final WebP conversion remain in place.

`PATCH /api/admin/items` accepts `{ companyId, id, expectedUpdatedAt, values }`. Omitted field keys stay unchanged; an explicitly blank optional value clears it. HTTP 409 means the editor's snapshot is stale: close, refresh and reopen the item. Missing items return 404. Success returns `{ id, designNo }`.

## Add or replace an item's video

Open the specific item's **Edit** dialog and use the visible **Product video** section. Choose **Add video** or **Replace video** and select one MP4 or WebM file up to 50 MB. A local preview appears before uploading; **Cancel selected video** keeps the current video. Alternatively, paste a YouTube or public video URL into **Video link**. **Remove video** clears the item's video link when saved. MP4 with H.264 encoding offers broad browser playback support.

Choose **Save changes** to save item details, queued photos, then the video. Video bytes upload directly from the browser to a signed Supabase Storage URL with percentage progress. The editor shows **Retry video upload** on failure. Retry reuses the same upload ID, skips an already uploaded file and finishes attaching it to the item. Saved details stay locked during recovery. Closing after a partial save keeps completed changes and refreshes the library.

`POST /api/admin/items/videos` accepts small same-origin JSON requests containing `action: prepare|complete`, `companyId`, `itemId`, `uploadId`, `contentType`, `size` and `expectedVideoUrl`. Preparation verifies the active company, item membership and unchanged video before issuing a signed upload URL without overwrite permission. Completion checks the stored byte count, content type and video file header, then conditionally updates only `items.video_url` and `items.video_source`. Concurrent video changes return HTTP 409. Successful attachments invalidate the storefront catalogue cache. The existing product gallery displays videos after photos; PDFs continue to exclude them.

Videos use the existing public `item_images` bucket at `dashboard/<company>/<item>/videos/<upload-id>.mp4` (or `.webm`). Files are uploaded as selected without transcoding. The flow does not add photo gallery rows. Replacing or removing a video changes the item's link and retains previous stored files; abandoned uploads may also leave unattached objects. No bucket or database migration is required. Server credentials stay on the server; the browser receives only the signed URL for its upload.

## Add a product

Select **Add product** in the item library. Enter a unique design number (Item Name), an existing Item Group and an Item Type. Print Name supplies the storefront title; Code can be left blank to generate one. Reference dropdowns include active records for the selected company and shared company, with Selling lists only for Website Price List.

Website details include description, minimum order quantity, order multiple and visibility. New products default to active, sales allowed, hidden from the website, and quantity/multiple of one. Expand **More item details** for the remaining template fields, including dimensions, stock, tax, units and variants. The same photo, video and link controls are available when creating a product. Selling-price amounts continue to be managed through the existing price lists.

Saving creates one item, refreshes the library and invalidates the catalogue cache. Duplicate design numbers or codes are rejected; this action never updates an existing product. Validation or save errors keep the form entries available for correction and retry. Reference records must already exist; the spreadsheet import workflow still supports creating missing references.

`POST /api/admin/items` accepts JSON `{ companyId, values }`, where `values` maps supported item field keys to strings using the import template's conventions (including `is_active` as **Disable**, so `N` means active). Record IDs, company assignment and timestamps cannot be supplied as item fields. Successful creation returns HTTP 201 with `{ id, designNo }`; invalid values return 400 and duplicates return 409. Requests require a matching Origin and are limited to 256 KB. The same existing access policy as imports applies.

The previous single-photo multipart POST/PATCH format (`payload` JSON and `photo`) remains supported for direct API clients and replaces the main photo/thumbnail. The dashboard uses JSON for item details and the gallery endpoint for every uploaded photo. JSON remains limited to 256 KB; each photo request has a separate 3 MB image limit.

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

Read routes: `GET /api/admin/items?companyId=…` returns library summaries; add `view=editor&itemId=…` for one item's fields, gallery and form options (omit `itemId` for a new-product form), or `view=export` for CSV rows including headers. All reads return `Cache-Control: private, no-store`.

Import route: `POST /api/admin/items/import` with multipart `file`, `companyId`, `createMissing`, `action=preview|commit`, and the preview `token` on commit.

Run `npm test` and `npx tsc --noEmit --incremental false`. Video upload coverage is in `tests/admin-item-video.test.cjs`; photo replacement and PDF tests also run with `npm test`. Tests use isolated fake databases and storage, generated media bytes, browser API doubles and DOM fixtures and do not modify live inventory.

Read-only preview of the supplied template on 19 September 2026 recognised 52 columns and 53 item rows: 52 updates and one invalid row. Row 2 names AC-590 but carries AC-114's record ID and code IT1631. Correct or clear **both** stale identifiers before importing AC-590. The file proposes the new category names `Wedding Card` and `Hindu Wedding Card`; the existing `Wedding Cards` name remains a separate reference. No rows from this file were committed during implementation.
