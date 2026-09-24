import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ItemCreateError } from "@/lib/admin/item-create";
import { parseItemVideoRequest, saveItemVideo } from "@/lib/admin/item-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Open the dashboard on this site to add videos." }, { status: 403, headers });
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      throw new ItemCreateError("Send video upload details as JSON.", 415);
    if (Number(request.headers.get("content-length")) > 8192)
      throw new ItemCreateError("Video upload details are too large.", 413);
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) throw new ItemCreateError("Video upload details are too large.", 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new ItemCreateError("Send valid video upload details."); }
    const result = await saveItemVideo(parseItemVideoRequest(body));
    if (result.saved) {
      try { revalidateTag("catalogue"); revalidatePath("/", "layout"); }
      catch { /* Existing cache expiry remains a fallback after a successful save. */ }
    }
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, {
      status: error instanceof ItemCreateError ? error.status : 503, headers,
    });
  }
}
