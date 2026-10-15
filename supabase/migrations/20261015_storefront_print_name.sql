-- Expose Print Name separately from the item's design number and display title.
-- Apply after 20261012_storefront_products.sql as the database owner.
-- Append the column so existing view columns and dependent objects retain their
-- identities. storefront_product_page serializes the complete view row and
-- automatically includes print_name without a function signature change.
BEGIN;
CREATE OR REPLACE VIEW public.v_storefront_products
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
    item.id,
    item.code AS item_code,
    item.name AS design_no,
    trim(BOTH '-' FROM lower(regexp_replace(item.name, '[^A-Za-z0-9]+', '-', 'g'))) AS slug,
    coalesce(nullif(btrim(item.web_title, whitespace.characters), ''),
             nullif(item.print_name, ''), item.name) AS name,
    coalesce(nullif(item.web_description, ''), item.description, '') AS description,
    selling_price.website_price AS price,
    selling_price.rate AS mrp,
    selling_price.gst_pct,
    item.image_url,
    item.thumb_url,
    gallery.images,
    CASE WHEN nullif(item.video_url, '') IS NULL THEN '[]'::jsonb
         ELSE jsonb_build_array(item.video_url) END AS videos,
    subject.name AS subject,
    item_tags.tags,
    item.catalog_tag AS badge,
    item.offer_pct,
    item.offer_upto,
    item.stock_status,
    item.stock_expected_date,
    item.min_order_qty,
    item.order_multiple,
    item_group.name AS group_name,
    parent_group.name AS parent_group_name,
    item.item_width AS width_mm,
    item.item_length AS length_mm,
    item.item_height AS height_mm,
    item.weight_per_unit AS weight_g,
    item.hsn_sac,
    item.has_variants,
    item.variant_of,
    item.variant_attributes,
    item.updated_at,
    coalesce(item_category.name, '') AS item_category,
    lower(btrim(coalesce(subject.name, ''), whitespace.characters)) AS subject_key,
    CASE
        WHEN lower(subject.name) LIKE '%luxe%' OR lower(subject.name) LIKE '%luxury%' THEN 'luxe'
        WHEN lower(subject.name) LIKE '%house%' THEN 'housewarming'
        WHEN lower(subject.name) LIKE '%thread%' THEN 'thread-ceremony'
        WHEN lower(subject.name) LIKE '%naming%' THEN 'naming-ceremony'
        WHEN lower(subject.name) LIKE '%birthday%' THEN 'birthday'
        WHEN lower(subject.name) LIKE '%baby%' THEN 'baby-shower'
        ELSE 'wedding'
    END AS normalized_category,
    lower(btrim(coalesce(subject.name, ''), whitespace.characters))
        NOT IN ('shagun envelopes', 'wedding box', 'rakhi') AS wedding_eligible,
    gallery.has_photo,
    coalesce(selling_price.website_price, 0) > 0 AS has_price,
    coalesce(selling_price.website_price, 0) AS display_price,
    CASE WHEN selling_price.website_price > 0
              AND selling_price.rate > selling_price.website_price
         THEN floor((selling_price.rate::double precision - selling_price.website_price::double precision)
                    / selling_price.rate::double precision * 100 + 0.5)::integer
         ELSE 0 END AS discount_percent,
    item.print_name
FROM public.items AS item
-- ECMAScript String.trim() whitespace, used by the existing title/media helpers.
CROSS JOIN (VALUES (E' \t\n\r\f\013' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))
    AS whitespace(characters)
LEFT JOIN public.subjects AS subject ON subject.id = item.subject_id
LEFT JOIN public.item_categories AS item_category ON item_category.id = item.item_category_id
LEFT JOIN public.item_groups AS item_group ON item_group.id = item.group_id
LEFT JOIN public.item_groups AS parent_group ON parent_group.id = item_group.parent_id
LEFT JOIN LATERAL (
    -- First choose the latest revision in EACH list, then apply list preference.
    -- A newer unpriced revision must suppress an older priced revision.
    SELECT latest.website_price, latest.rate, latest.gst_pct
    FROM (
        SELECT DISTINCT ON (resolved.price_list_id)
            resolved.price_list_id, resolved.effective_from,
            price_list.code AS list_code,
            price_row.website_price, price_row.rate, price_row.gst_pct
        FROM public.price_list_transaction_items AS price_row
        LEFT JOIN public.price_list_transactions AS draft
          ON price_row.row_status = 'Draft'
         AND draft.id = price_row.transaction_id
         AND draft.company_id = price_row.company_id
         AND draft.transaction_type = 'Selling'
         AND draft.status = 'Draft'
         AND draft.is_active
        CROSS JOIN LATERAL (
            SELECT
                CASE WHEN price_row.row_status = 'Draft' THEN draft.price_list_id
                     ELSE price_row.price_list_id END AS price_list_id,
                CASE WHEN price_row.row_status = 'Draft'
                     THEN coalesce(draft.effective_from, price_row.effective_from)
                     ELSE price_row.effective_from END AS effective_from,
                -- Date.parse in the existing resolver compares milliseconds.
                date_trunc('milliseconds', greatest('epoch'::timestamptz,
                    price_row.created_at, price_row.updated_at,
                    draft.created_at, draft.updated_at)) AS revision_time
        ) AS resolved
        JOIN public.price_lists AS price_list ON price_list.id = resolved.price_list_id
        WHERE price_row.item_id = item.id
          AND price_row.is_active
          AND (price_row.effective_to IS NULL OR price_row.effective_to >= current_date)
          AND ((price_row.row_status = 'Active' AND price_row.transaction_type = 'Selling')
               OR (price_row.row_status = 'Draft' AND draft.id IS NOT NULL))
        ORDER BY resolved.price_list_id,
                 resolved.effective_from DESC NULLS LAST,
                 resolved.revision_time DESC,
                 (price_row.row_status = 'Draft') DESC,
                 price_row.website_price DESC NULLS LAST,
                 price_row.rate DESC NULLS LAST,
                 price_row.discount_pct DESC NULLS LAST,
                 price_row.gst_pct DESC NULLS LAST,
                 price_row.id
    ) AS latest
    ORDER BY coalesce(latest.price_list_id = item.website_price_list_id, false) DESC,
             (latest.website_price IS NOT NULL) DESC,
             coalesce(latest.list_code = 'PL0001', false) DESC,
             latest.effective_from DESC NULLS LAST,
             latest.price_list_id
    LIMIT 1
) AS selling_price ON true
LEFT JOIN LATERAL (
    SELECT coalesce(jsonb_agg(unique_image.image_url ORDER BY unique_image.first_position),
                    '[]'::jsonb) AS images,
           coalesce(bool_or(nullif(btrim(unique_image.image_url, whitespace.characters), '') IS NOT NULL),
                    false) AS has_photo
    FROM (
        SELECT image.image_url, min(image.position) AS first_position
        FROM (
            SELECT nullif(item.image_url, '') AS image_url, 0::bigint AS position
            UNION ALL
            SELECT nullif(item_image.image_url, ''),
                   row_number() OVER (ORDER BY item_image.sort_order NULLS LAST,
                                              item_image.created_at NULLS LAST,
                                              item_image.image_url)
            FROM public.item_images AS item_image
            WHERE item_image.item_id = item.id AND NOT item_image.is_deleted
        ) AS image
        WHERE image.image_url IS NOT NULL
        GROUP BY image.image_url
    ) AS unique_image
) AS gallery ON true
LEFT JOIN LATERAL (
    SELECT coalesce(array_agg(tag.name::text ORDER BY tagged_id.position), ARRAY[]::text[]) AS tags
    FROM jsonb_array_elements_text(coalesce(item.website_tag_ids, '[]'::jsonb))
         WITH ORDINALITY AS tagged_id(id, position)
    JOIN public.website_tags AS tag ON tag.id = tagged_id.id::uuid
    WHERE tag.is_active AND tag.name IS NOT NULL
) AS item_tags ON true
WHERE item.show_on_website AND item.is_active;

COMMENT ON VIEW public.v_storefront_products IS
    'Beyond Invitation public storefront: published active items, trimmed Web Titles and latest eligible Active/Draft Selling prices. Uses database-owner privileges with security_barrier=true; excludes purchase prices, costs, valuation, supplier details and stock quantities. No base-table grants or RLS changes.';
REVOKE ALL ON public.v_storefront_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_storefront_products TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;