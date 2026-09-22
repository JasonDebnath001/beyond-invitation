import { BLOG_MAX_BODY, BlogError } from "@/lib/blog";

/** Bound the stream, including requests without a Content-Length header. */
export async function readBlogBody(request: Request, limit = BLOG_MAX_BODY) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new BlogError("This upload is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new BlogError("Send the article details.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BlogError("This upload is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function checkBlogOrigin(request: Request) {
  // Match the explicitly deferred authentication policy of the existing admin.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new BlogError(
      "Open the admin on this website to save articles or images.",
      403,
    );
}
