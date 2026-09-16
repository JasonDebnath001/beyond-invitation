-- Beyond Invitation: public product catalogue shared with Samriddhi.
-- Run as the database owner (for example, postgres in the Supabase SQL editor)
-- so the view owner can intentionally bypass the ERP's base-table SELECT RLS.
-- This migration does not change base-table policies or grant base-table access.

BEGIN;

-- Preserve all existing subjects, including their casing and company assignment.
INSERT INTO public.subjects (name, company_id)
SELECT
    storefront_subject.name,
    (SELECT company_id FROM public.subjects ORDER BY id LIMIT 1)
FROM (VALUES
    ('Wedding Card'),
    ('Hindu Wedding Card'),
    ('Muslim Wedding Card'),
    ('Christian Wedding Card'),
    ('Shagun Envelopes'),
    ('Wedding Box'),
    ('Rakhi')
) AS storefront_subject(name)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.subjects AS existing_subject
    WHERE lower(existing_subject.name) = lower(storefront_subject.name)
);

CREATE OR REPLACE VIEW public.v_web_products
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
    item.id,
    item.code AS item_code,
    item.name AS design_no,
    trim(BOTH '-' FROM lower(regexp_replace(item.name, '[^A-Za-z0-9]+', '-', 'g'))) AS slug,
    coalesce(nullif(item.print_name, ''), item.name) AS name,
    coalesce(nullif(item.web_description, ''), item.description, '') AS description,
    selling_price.price,
    selling_price.mrp,
    selling_price.gst_pct,
    item.image_url,
    item.thumb_url,
    gallery.images,
    CASE
        WHEN nullif(item.video_url, '') IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array(item.video_url)
    END AS videos,
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
    item.updated_at
FROM public.items AS item
LEFT JOIN public.subjects AS subject ON subject.id = item.subject_id
LEFT JOIN public.item_groups AS item_group ON item_group.id = item.group_id
LEFT JOIN public.item_groups AS parent_group ON parent_group.id = item_group.parent_id
LEFT JOIN LATERAL (
    -- Compute MRP inside this join: even an item-level MRP must remain NULL
    -- when no qualifying Selling row exists.
    SELECT
        chosen.price,
        coalesce(
            item.mrp,
            CASE WHEN chosen.discount_pct > 0 THEN chosen.rate END,
            chosen.price
        ) AS mrp,
        chosen.gst_pct
    FROM (
        SELECT
            coalesce(
                price_row.website_price,
                round(
                    (price_row.rate * (1 - coalesce(price_row.discount_pct, 0)::numeric / 100))::numeric,
                    2
                )
            ) AS price,
            price_row.rate,
            price_row.discount_pct,
            price_row.gst_pct
        FROM public.price_list_transaction_items AS price_row
        JOIN public.price_lists AS price_list ON price_list.id = price_row.price_list_id
        WHERE price_row.item_id = item.id
          AND price_row.transaction_type = 'Selling'
          AND price_row.is_active
          AND price_row.row_status = 'Active'
          AND (price_row.effective_to IS NULL OR price_row.effective_to >= current_date)
        ORDER BY
            (price_row.price_list_id = item.website_price_list_id) DESC NULLS LAST,
            (price_row.website_price IS NOT NULL) DESC,
            (price_list.code = 'PL0001') DESC NULLS LAST,
            -- Prefer the latest effective row when the requested priorities tie.
            price_row.effective_from DESC NULLS LAST,
            price_row.price_list_id,
            price_row.website_price DESC NULLS LAST,
            price_row.rate DESC NULLS LAST,
            price_row.discount_pct DESC NULLS LAST,
            price_row.gst_pct DESC NULLS LAST
        LIMIT 1
    ) AS chosen
) AS selling_price ON true
LEFT JOIN LATERAL (
    SELECT coalesce(
        jsonb_agg(unique_image.image_url ORDER BY unique_image.first_position),
        '[]'::jsonb
    ) AS images
    FROM (
        SELECT image.image_url, min(image.position) AS first_position
        FROM (
            SELECT nullif(item.image_url, '') AS image_url, 0::bigint AS position
            UNION ALL
            SELECT
                nullif(item_image.image_url, ''),
                row_number() OVER (
                    ORDER BY item_image.sort_order NULLS LAST,
                             item_image.created_at NULLS LAST,
                             item_image.image_url
                )
            FROM public.item_images AS item_image
            WHERE item_image.item_id = item.id
              AND NOT item_image.is_deleted
        ) AS image
        WHERE image.image_url IS NOT NULL
        GROUP BY image.image_url
    ) AS unique_image
) AS gallery ON true
LEFT JOIN LATERAL (
    SELECT coalesce(
        array_agg(tag.name::text ORDER BY tagged_id.position),
        ARRAY[]::text[]
    ) AS tags
    FROM jsonb_array_elements_text(
        coalesce(item.website_tag_ids, '[]'::jsonb)
    ) WITH ORDINALITY AS tagged_id(id, position)
    JOIN public.website_tags AS tag ON tag.id = tagged_id.id::uuid
    WHERE tag.is_active
      AND tag.name IS NOT NULL
) AS item_tags ON true
WHERE item.show_on_website AND item.is_active;

COMMENT ON VIEW public.v_web_products IS
    'Public storefront contract for Beyond Invitation / Samriddhi. Intentionally bypasses base-table RLS through its database-owner privileges (security_invoker=false). Exposes only active, website-visible items and selected Selling prices; excludes purchase prices, costs, valuation, supplier details and stock quantities. Storefront clients must read this view rather than the ERP tables.';

-- Restrict any inherited/default view grants to the intended read-only contract.
REVOKE ALL ON public.v_web_products FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_web_products TO anon, authenticated;

COMMIT;

-- Verification: run these separately after the migration succeeds.
-- Total rows: expect 158 with today's data.
-- SELECT count(*) AS web_product_count FROM public.v_web_products;

-- Priced rows: expect approximately 31 today; unpriced products stay visible.
-- SELECT count(*) AS priced_product_count
-- FROM public.v_web_products WHERE price IS NOT NULL;

-- Nonempty slugs: expect zero rows.
-- SELECT id, design_no, slug
-- FROM public.v_web_products WHERE slug IS NULL OR slug = '';

-- Unique slugs: expect zero rows.
-- SELECT slug, count(*) AS product_count
-- FROM public.v_web_products GROUP BY slug HAVING count(*) > 1;

-- Optional: verify that the anon role can read the same public row set.
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) AS anon_web_product_count FROM public.v_web_products;
-- ROLLBACK;
