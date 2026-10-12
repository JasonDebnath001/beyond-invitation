-- Beyond Invitation: one public read for titles, current Selling prices and
-- collection filters. Deploy this migration before the matching application.
-- Run as the database owner, as with v_web_products. The ERP's existing view,
-- base-table privileges and RLS policies are intentionally left untouched.
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
         ELSE 0 END AS discount_percent
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

-- Filter and sort on the visitor's displayed price BEFORE selecting a page.
-- Only base product rows leave the database; the server applies its existing
-- display/checkout pricing helper to the returned, bounded product list.
CREATE OR REPLACE FUNCTION public.storefront_product_page(
    p_offset integer DEFAULT 0,
    p_limit integer DEFAULT 24,
    p_category text DEFAULT NULL,
    p_subjects text[] DEFAULT NULL,
    p_item_category text DEFAULT NULL,
    p_wedding_only boolean DEFAULT false,
    p_exclude_slug text DEFAULT NULL,
    p_sort text DEFAULT 'catalogue',
    p_price_min numeric DEFAULT NULL,
    p_price_max numeric DEFAULT NULL,
    p_price_max_inclusive boolean DEFAULT false,
    p_on_request boolean DEFAULT false,
    p_margin_percent numeric DEFAULT 0,
    p_filter_item_category text DEFAULT NULL,
    p_include_facets boolean DEFAULT false,
    p_wedding_collection boolean DEFAULT false,
    p_priced_only boolean DEFAULT false,
    p_price_min_exclusive boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
    result jsonb;
BEGIN
    IF p_offset IS NULL OR p_offset < 0 OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'Invalid storefront page range' USING ERRCODE = '22023';
    END IF;
    IF p_sort IS NULL OR p_sort NOT IN ('catalogue', 'recommended', 'newest',
            'price-asc', 'price-desc', 'generic-price-asc', 'generic-price-desc', 'discount') THEN
        RAISE EXCEPTION 'Invalid storefront sort' USING ERRCODE = '22023';
    END IF;
    IF p_margin_percent IS NULL OR p_margin_percent < 0
       OR p_margin_percent::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Invalid storefront margin' USING ERRCODE = '22023';
    END IF;
    IF p_price_min::text IN ('NaN', 'Infinity', '-Infinity')
       OR p_price_max::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Invalid storefront price range' USING ERRCODE = '22023';
    END IF;

    WITH scoped AS MATERIALIZED (
        SELECT product AS base_product,
            -- Double precision and floor(x + .5) match JavaScript's Number /
            -- Math.round calculations (numeric rounding can differ at a tie).
            CASE WHEN product.price > 0 AND p_margin_percent > 0
                 THEN floor(product.price::double precision * (1 + p_margin_percent::double precision / 100) + 0.5)
                 ELSE coalesce(product.price, 0)::double precision END AS visitor_price,
            CASE WHEN product.mrp > 0 AND p_margin_percent > 0
                 THEN floor(product.mrp::double precision * (1 + p_margin_percent::double precision / 100) + 0.5)
                 ELSE coalesce(product.mrp, 0)::double precision END AS visitor_mrp
        FROM public.v_storefront_products AS product
        WHERE (p_category IS NULL OR product.normalized_category = p_category)
          AND (p_subjects IS NULL OR product.subject_key = ANY(p_subjects))
          AND (p_item_category IS NULL OR product.item_category = p_item_category)
          AND (NOT p_wedding_only OR product.wedding_eligible)
          AND (NOT p_wedding_collection OR product.wedding_eligible
               OR product.item_category IN ('Hindu Wedding Card', 'Wedding Card'))
          AND (p_exclude_slug IS NULL OR product.slug <> p_exclude_slug)
    ), filtered AS MATERIALIZED (
        SELECT *,
            CASE WHEN visitor_price > 0 AND visitor_mrp > visitor_price
                 THEN floor((visitor_mrp - visitor_price) / visitor_mrp * 100 + 0.5)
                 ELSE 0 END AS visitor_discount
        FROM scoped
        WHERE (p_filter_item_category IS NULL OR (base_product).item_category = p_filter_item_category)
          AND (NOT p_on_request OR visitor_price <= 0)
          AND (NOT p_priced_only OR visitor_price > 0)
          AND (p_price_min IS NULL OR
               CASE WHEN p_price_min_exclusive THEN visitor_price > p_price_min
                    ELSE visitor_price >= p_price_min END)
          AND (p_price_max IS NULL OR (
               CASE WHEN p_price_max_inclusive THEN visitor_price <= p_price_max
                    ELSE visitor_price < p_price_max END))
    ), ordered AS (
        SELECT base_product,
            row_number() OVER (ORDER BY
                CASE WHEN p_sort IN ('price-asc', 'price-desc') THEN visitor_price > 0 END DESC,
                CASE WHEN p_sort = 'price-asc' AND visitor_price > 0 THEN visitor_price
                     WHEN p_sort = 'generic-price-asc' THEN visitor_price END ASC,
                CASE WHEN p_sort = 'price-desc' AND visitor_price > 0 THEN visitor_price
                     WHEN p_sort = 'generic-price-desc' THEN visitor_price END DESC,
                CASE WHEN p_sort = 'discount' THEN visitor_discount END DESC,
                CASE WHEN p_sort IN ('recommended', 'price-asc', 'price-desc')
                           OR (p_wedding_only AND p_sort IN ('generic-price-asc', 'generic-price-desc', 'discount'))
                     THEN (base_product).has_photo END DESC,
                CASE WHEN p_sort IN ('recommended', 'price-asc', 'price-desc')
                           OR (p_wedding_only AND p_sort IN ('generic-price-asc', 'generic-price-desc', 'discount'))
                     THEN (base_product).has_price END DESC,
                (base_product).updated_at DESC NULLS LAST,
                CASE WHEN p_sort IN ('recommended', 'newest', 'price-asc', 'price-desc')
                           OR (p_wedding_only AND p_sort IN ('generic-price-asc', 'generic-price-desc', 'discount'))
                     THEN (base_product).slug END ASC,
                (base_product).id ASC
            ) AS position
        FROM filtered
    ), page AS (
        SELECT * FROM ordered ORDER BY position LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
        'products', coalesce((SELECT jsonb_agg(to_jsonb(base_product) ORDER BY position) FROM page), '[]'::jsonb),
        'nextOffset', CASE WHEN p_offset::bigint + p_limit < (SELECT count(*) FROM filtered)
                           THEN p_offset::bigint + p_limit ELSE NULL END,
        'total', (SELECT count(*) FROM filtered),
        'facets', CASE WHEN p_include_facets THEN (
            SELECT jsonb_build_object(
                'total', count(*),
                'types', jsonb_build_object(
                    'hindu', count(*) FILTER (WHERE (base_product).item_category = 'Hindu Wedding Card'),
                    'muslim', count(*) FILTER (WHERE (base_product).item_category = 'Wedding Card'),
                    'christian', count(*) FILTER (WHERE (base_product).item_category = 'Wedding Card')),
                'prices', jsonb_build_object(
                    'under-25', count(*) FILTER (WHERE visitor_price > 0 AND visitor_price < 25),
                    '25-50', count(*) FILTER (WHERE visitor_price >= 25 AND visitor_price < 50),
                    '50-100', count(*) FILTER (WHERE visitor_price >= 50 AND visitor_price <= 100),
                    'above-100', count(*) FILTER (WHERE visitor_price > 100),
                    'on-request', count(*) FILTER (WHERE visitor_price <= 0)))
            FROM scoped
        ) ELSE NULL END
    ) INTO result;
    RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.storefront_product_page(integer, integer, text, text[], text, boolean, text, text, numeric, numeric, boolean, boolean, numeric, text, boolean, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_product_page(integer, integer, text, text[], text, boolean, text, text, numeric, numeric, boolean, boolean, numeric, text, boolean, boolean, boolean, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
