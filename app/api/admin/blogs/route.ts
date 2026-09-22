import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { BlogError } from "@/lib/blog";
import {
  getAdminBlog,
  listAdminBlogs,
  saveBlog,
} from "@/lib/admin/blog-service";
import { checkBlogOrigin, readBlogBody } from "@/lib/admin/blog-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof BlogError
          ? error.message
          : "The blog service is unavailable. Please retry.",
    },
    { status: error instanceof BlogError ? error.status : 503, headers },
  );
}
export async function GET(request: NextRequest) {
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(12000),
    ]);
    const id = request.nextUrl.searchParams.get("id");
    return NextResponse.json(
      id
        ? { post: await getAdminBlog(id, signal) }
        : { posts: await listAdminBlogs(signal) },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
async function save(request: NextRequest, editing: boolean) {
  try {
    checkBlogOrigin(request);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      throw new BlogError("Send article details as JSON.", 415);
    const bytes = await readBlogBody(request);
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new BlogError("Send valid article details.");
    }
    const { post, previousSlug } = await saveBlog(
      body,
      editing,
      AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    );
    // Saving has succeeded even if cache revalidation is temporarily unavailable.
    try {
      revalidatePath("/blog");
      revalidatePath(`/blog/${post.slug}`);
      revalidatePath("/sitemap.xml");
      if (previousSlug && previousSlug !== post.slug)
        revalidatePath(`/blog/${previousSlug}`);
    } catch {
      /* Public blog reads are also uncached. */
    }
    return NextResponse.json(
      { post },
      { status: editing ? 200 : 201, headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export const POST = (request: NextRequest) => save(request, false);
export const PATCH = (request: NextRequest) => save(request, true);
