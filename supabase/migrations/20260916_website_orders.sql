-- Run once as the database owner in the Supabase SQL Editor.
-- Independent of catalogue/ERP tables: order items and addresses are snapshots.
BEGIN;

CREATE TABLE public.website_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name text NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 1 AND 200),
    customer_email text NOT NULL CHECK (char_length(customer_email) BETWEEN 3 AND 254),
    customer_phone text NOT NULL CHECK (char_length(btrim(customer_phone)) BETWEEN 1 AND 40),
    shipping_address jsonb NOT NULL CHECK (jsonb_typeof(shipping_address) = 'object'),
    notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
    -- ResolvedLine[]: itemCode, name, basePrice and price (INR), quantity.
    items jsonb NOT NULL CHECK (
        jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 100
    ),
    amount_paise integer NOT NULL CHECK (amount_paise >= 100),
    currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    reseller_code text,
    commission_paise integer NOT NULL DEFAULT 0 CHECK (
        commission_paise >= 0 AND commission_paise <= amount_paise
    ),
    razorpay_order_id text UNIQUE CHECK (razorpay_order_id ~ '^order_[A-Za-z0-9]+$'),
    razorpay_payment_id text UNIQUE CHECK (razorpay_payment_id ~ '^pay_[A-Za-z0-9]+$'),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    CHECK (
        (payment_status = 'pending' AND paid_at IS NULL AND razorpay_payment_id IS NULL)
        OR (payment_status = 'paid' AND paid_at IS NOT NULL
            AND razorpay_order_id IS NOT NULL AND razorpay_payment_id IS NOT NULL)
    )
);

CREATE INDEX website_orders_user_created_idx ON public.website_orders (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.website_orders IS
    'Website checkout snapshots. Only the backend writes orders or confirms payments. Guest orders have no user_id; customer email never grants access.';

ALTER TABLE public.website_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.website_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.website_orders TO service_role;

CREATE POLICY website_orders_select_own ON public.website_orders
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION public.mark_website_order_paid(
    p_razorpay_order_id text,
    p_razorpay_payment_id text,
    p_amount_paise integer,
    p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    saved public.website_orders%ROWTYPE;
BEGIN
    SELECT * INTO saved FROM public.website_orders
    WHERE razorpay_order_id = p_razorpay_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Website order not found.';
    END IF;
    IF p_razorpay_payment_id IS NULL OR p_razorpay_payment_id !~ '^pay_[A-Za-z0-9]+$'
        OR p_amount_paise IS DISTINCT FROM saved.amount_paise
        OR p_currency IS DISTINCT FROM saved.currency THEN
        RAISE EXCEPTION 'Payment does not match the website order.';
    END IF;

    IF saved.payment_status = 'paid' THEN
        IF saved.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id THEN
            RAISE EXCEPTION 'Website order already has a different payment.';
        END IF;
        RETURN jsonb_build_object('id', saved.id);
    END IF;

    UPDATE public.website_orders SET
        payment_status = 'paid',
        razorpay_payment_id = p_razorpay_payment_id,
        paid_at = now()
    WHERE id = saved.id;

    RETURN jsonb_build_object('id', saved.id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_website_order_paid(text, text, integer, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_website_order_paid(text, text, integer, text)
    TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
