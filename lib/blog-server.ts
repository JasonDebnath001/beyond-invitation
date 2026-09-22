import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { BLOG_SUMMARY_COLUMNS, type BlogPost, type BlogSummary } from "./blog";

// Use the public role and RLS for storefront reads, never the admin service key.
function publicBlogDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Blog database is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

export const getPublishedBlogs = cache(async (): Promise<BlogSummary[]> => {
  const db = publicBlogDb();
  const posts: BlogSummary[] = [];
  const signal = AbortSignal.timeout(12000);
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("blog_posts")
      .select(BLOG_SUMMARY_COLUMNS)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .order("id")
      .range(offset, offset + 999)
      .abortSignal(signal);
    if (error) throw new Error("Could not load articles.");
    posts.push(...(data as BlogSummary[]));
    if (data.length < 1000) return posts;
  }
});

export const getPublishedBlog = cache(
  async (slug: string): Promise<BlogPost | null> => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
      return null;
    const { data, error } = await publicBlogDb()
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .abortSignal(AbortSignal.timeout(12000))
      .maybeSingle();
    if (error)
      throw new Error("Could not load this article. Please try again shortly.");
    return data as BlogPost | null;
  },
);
