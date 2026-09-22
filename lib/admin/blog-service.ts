import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BLOG_SUMMARY_COLUMNS,
  BLOG_UUID,
  BlogError,
  parseBlogInput,
  readingMinutes,
  type BlogPost,
} from "@/lib/blog";

function databaseError(error: { code?: string; message: string }): never {
  if (error.code === "23505")
    throw new BlogError(
      "That URL slug is already in use. Choose a different one.",
      409,
    );
  if (["42P01", "PGRST205"].includes(error.code || ""))
    throw new BlogError(
      "Blog storage is not set up yet. Apply supabase/migrations/20260922_blog_posts.sql in Supabase, then retry.",
      503,
    );
  console.error("Blog database operation failed:", error.code);
  throw new BlogError(
    "Could not save or load this article. Please retry.",
    503,
  );
}

export async function listAdminBlogs(signal: AbortSignal) {
  const db = getSupabaseAdminClient();
  const posts = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("blog_posts")
      .select(BLOG_SUMMARY_COLUMNS)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(offset, offset + 999)
      .abortSignal(signal);
    if (error) databaseError(error);
    posts.push(...data);
    if (data.length < 1000) return posts;
  }
}

export async function getAdminBlog(id: string, signal: AbortSignal) {
  if (!BLOG_UUID.test(id)) throw new BlogError("Choose a valid article.");
  const { data, error } = await getSupabaseAdminClient()
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .abortSignal(signal)
    .maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new BlogError("This article could not be found.", 404);
  return data as BlogPost;
}

export async function saveBlog(
  body: unknown,
  editing: boolean,
  signal: AbortSignal,
) {
  const input = parseBlogInput(body);
  const request = body as Record<string, unknown>;
  if (typeof request.id !== "string" || !BLOG_UUID.test(request.id))
    throw new BlogError("A valid article ID is required.");
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const fields = { ...input, reading_minutes: readingMinutes(input.content) };
  if (!editing) {
    const { data, error } = await db
      .from("blog_posts")
      .insert({
        ...fields,
        id: request.id,
        published_at: input.status === "published" ? now : null,
      })
      .select("*")
      .abortSignal(signal)
      .single();
    if (error) {
      // A stable client ID makes retrying a creation after a lost response safe.
      if (error.code === "23505") {
        const existing = await db
          .from("blog_posts")
          .select("*")
          .eq("id", request.id)
          .abortSignal(signal)
          .maybeSingle();
        if (
          existing.data &&
          Object.entries(fields).every(
            ([key, value]) => existing.data[key] === value,
          )
        )
          return { post: existing.data as BlogPost, previousSlug: null };
      }
      databaseError(error);
    }
    return { post: data as BlogPost, previousSlug: null };
  }
  if (
    typeof request.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(request.expectedUpdatedAt))
  )
    throw new BlogError("Reload this article before saving.", 409);
  const previous = await getAdminBlog(request.id, signal);
  const { data, error } = await db
    .from("blog_posts")
    .update({
      ...fields,
      published_at:
        input.status === "published"
          ? previous.published_at || now
          : previous.published_at,
    })
    .eq("id", request.id)
    .eq("updated_at", request.expectedUpdatedAt)
    .select("*")
    .abortSignal(signal)
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new BlogError(
      "This article changed in another window. Copy your changes, then reload before saving.",
      409,
    );
  return { post: data as BlogPost, previousSlug: previous.slug };
}
