import { NextResponse, type NextRequest } from "next/server";
import { loadItemPhotoDownload, PhotoDownloadError } from "@/lib/admin/item-photo-download-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Open the dashboard on this site to download photos." }, { status: 403, headers });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12000)]);
  try {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      throw new PhotoDownloadError("Send the design numbers as JSON.", 415);
    const limit = 128 * 1024;
    if (Number(request.headers.get("content-length")) > limit)
      throw new PhotoDownloadError("The list is too large. Download fewer numbers at a time.", 413);
    const input = await request.text();
    if (Buffer.byteLength(input, "utf8") > limit)
      throw new PhotoDownloadError("The list is too large. Download fewer numbers at a time.", 413);
    let body: unknown;
    try { body = JSON.parse(input); }
    catch { throw new PhotoDownloadError("Enter a valid list of design numbers."); }
    return NextResponse.json(await loadItemPhotoDownload(body, signal), { headers });
  } catch (error) {
    return NextResponse.json({
      error: signal.aborted ? "The catalogue took too long to respond. Please retry." : (error as Error).message,
    }, { status: signal.aborted ? 504 : error instanceof PhotoDownloadError ? error.status : 503, headers });
  }
}
