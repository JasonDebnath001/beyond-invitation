export const BLOG_CATEGORIES = [
  "Wedding inspiration",
  "Invitation guides",
  "Traditions & celebrations",
  "Behind the craft",
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogStatus = "draft" | "published";
export type BlogInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  author: string;
  cover_image: string;
  cover_alt: string;
  featured: boolean;
  status: BlogStatus;
};
export type BlogPost = BlogInput & {
  id: string;
  reading_minutes: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type BlogSummary = Omit<BlogPost, "content">;
export const BLOG_SUMMARY_COLUMNS =
  "id,title,slug,excerpt,category,author,cover_image,cover_alt,featured,status,reading_minutes,published_at,created_at,updated_at";
export const BLOG_MAX_BODY = 256 * 1024;
export const BLOG_IMAGE_BYTES = 3 * 1024 * 1024;
export const BLOG_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BlogError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function blogSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .replace(/-$/, "");
}

/** Images can be local assets or HTTPS links; never executable/data URLs. */
export function safeBlogImage(value: string): boolean {
  if (!value || /[\s\\<>\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function readingMinutes(content: string) {
  const words = content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function blogDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "Unpublished";
}

export function parseBlogInput(body: unknown): BlogInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new BlogError("Enter the blog details.");
  const values = body as Record<string, unknown>;
  const text = (key: string, label: string, max: number, required = false) => {
    if (typeof values[key] !== "string") throw new BlogError(`Enter ${label}.`);
    const value = (values[key] as string).trim();
    if (required && !value) throw new BlogError(`Enter ${label}.`);
    if (value.length > max)
      throw new BlogError(
        `${label} must be ${max.toLocaleString()} characters or fewer.`,
      );
    return value;
  };
  const title = text("title", "a title", 180, true);
  const slug = text("slug", "a URL slug", 120, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new BlogError(
      "Use lowercase letters, numbers and single hyphens for the URL slug.",
    );
  if (!BLOG_CATEGORIES.includes(values.category as BlogCategory))
    throw new BlogError("Choose a blog category.");
  if (values.status !== "draft" && values.status !== "published")
    throw new BlogError("Choose draft or published.");
  if (typeof values.featured !== "boolean")
    throw new BlogError("Choose whether to feature this article.");
  const excerpt = text(
    "excerpt",
    "a short introduction",
    320,
    values.status === "published",
  );
  const content = text(
    "content",
    "article content",
    100000,
    values.status === "published",
  );
  const cover_image = text("cover_image", "a cover image URL", 2048);
  const cover_alt = text(
    "cover_alt",
    "a cover image description",
    250,
    !!cover_image,
  );
  if (cover_image && !safeBlogImage(cover_image))
    throw new BlogError("Use an HTTPS image URL or a local image path.");
  return {
    title,
    slug,
    excerpt,
    content,
    category: values.category as BlogCategory,
    author: text("author", "an author name", 100, true),
    cover_image,
    cover_alt,
    featured: values.featured,
    status: values.status,
  };
}
