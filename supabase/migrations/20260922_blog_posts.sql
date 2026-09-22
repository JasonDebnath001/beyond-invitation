-- Run once as the database owner in the Supabase SQL editor.
BEGIN;

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 180),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text NOT NULL DEFAULT '' CHECK (char_length(excerpt) <= 320),
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 100000),
  category text NOT NULL CHECK (category IN ('Wedding inspiration', 'Invitation guides', 'Traditions & celebrations', 'Behind the craft')),
  author text NOT NULL DEFAULT 'Beyond Invitation' CHECK (char_length(btrim(author)) BETWEEN 1 AND 100),
  cover_image text NOT NULL DEFAULT '' CHECK (char_length(cover_image) <= 2048),
  cover_alt text NOT NULL DEFAULT '' CHECK (char_length(cover_alt) <= 250),
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  reading_minutes integer NOT NULL DEFAULT 1 CHECK (reading_minutes > 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR (published_at IS NOT NULL AND btrim(excerpt) <> '' AND btrim(content) <> '')),
  CHECK (cover_image = '' OR btrim(cover_alt) <> '')
);
CREATE INDEX blog_posts_published ON public.blog_posts (published_at DESC, id) WHERE status = 'published';
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;
CREATE POLICY blog_posts_published_read ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at <= now());

CREATE FUNCTION public.blog_posts_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.blog_posts_touch_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER blog_posts_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_posts_touch_updated_at();

-- Public delivery, server-only uploads. No browser write policy is granted.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog_images', 'blog_images', true, 3145728, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
COMMIT;
