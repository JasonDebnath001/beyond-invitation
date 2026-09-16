-- Run as the database owner in the Supabase SQL editor after the catalogue migration.
BEGIN;

CREATE TABLE public.wishlist_items (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_slug text NOT NULL CHECK (
        product_slug = btrim(product_slug) AND char_length(product_slug) BETWEEN 1 AND 200
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_slug)
);

COMMENT ON TABLE public.wishlist_items IS
    'Private storefront wishlists. Slugs match v_web_products and existing product URLs. Unpublished products remain removable; deleting an Auth user removes their wishlist.';

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wishlist_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.wishlist_items TO authenticated;

CREATE POLICY wishlist_select_own ON public.wishlist_items
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY wishlist_insert_own ON public.wishlist_items
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
            SELECT 1 FROM public.v_web_products AS product
            WHERE product.slug = product_slug
        )
    );

CREATE POLICY wishlist_delete_own ON public.wishlist_items
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Enforce the limit even for direct REST writes and concurrent browser tabs.
-- Runs with the caller's privileges; it does not bypass row-level security.
CREATE FUNCTION public.enforce_wishlist_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text, 0));
    IF NOT EXISTS (
        SELECT 1 FROM public.wishlist_items
        WHERE user_id = NEW.user_id AND product_slug = NEW.product_slug
    ) AND (SELECT count(*) FROM public.wishlist_items WHERE user_id = NEW.user_id) >= 500 THEN
        RAISE EXCEPTION 'Wishlist is full (500 items).' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_wishlist_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER wishlist_limit BEFORE INSERT ON public.wishlist_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_wishlist_limit();

COMMIT;
