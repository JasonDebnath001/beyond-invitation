import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { BLOG_IMAGE_BYTES, BlogError } from "@/lib/blog";
import { checkBlogOrigin, readBlogBody } from "@/lib/admin/blog-request";
import { prepareItemPhoto } from "@/lib/admin/item-photo";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function POST(request: NextRequest) {
  try {
    checkBlogOrigin(request);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;"))
      throw new BlogError("Choose an image to upload.", 415);
    const bytes = await readBlogBody(request, BLOG_IMAGE_BYTES + 128 * 1024);
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": contentType },
      }).formData();
    } catch {
      throw new BlogError("Choose a valid image to upload.");
    }
    const file = form.get("image");
    if (!(file instanceof File))
      throw new BlogError("Choose an image to upload.");
    let image: Buffer;
    try {
      image = await prepareItemPhoto(file);
    } catch (error) {
      throw new BlogError(
        error instanceof Error
          ? error.message
          : "Choose a valid JPG, PNG or WebP image.",
      );
    }
    const bucket = getSupabaseAdminClient().storage.from("blog_images");
    const path = `articles/${randomUUID()}.webp`;
    const { error } = await bucket.upload(path, image, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (error)
      throw new BlogError(
        "Could not upload the image. Check that the blog_images bucket exists, then retry.",
        503,
      );
    return NextResponse.json(
      { url: bucket.getPublicUrl(path).data.publicUrl },
      { status: 201, headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BlogError
            ? error.message
            : "Image upload failed. Please retry.",
      },
      { status: error instanceof BlogError ? error.status : 503, headers },
    );
  }
}
