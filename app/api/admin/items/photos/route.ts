import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { MAX_PRODUCT_PHOTO_BYTES } from "@/lib/admin/item-fields";
import { ItemCreateError } from "@/lib/admin/item-create";
import { appendItemPhoto } from "@/lib/admin/item-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Open the dashboard on this site to add photos." }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > MAX_PRODUCT_PHOTO_BYTES + 128 * 1024)
    return NextResponse.json({ error: "Choose photos up to 3 MB each." }, { status: 413, headers });
  try {
    let form: FormData;
    try { form = await request.formData(); }
    catch { throw new ItemCreateError("Choose a photo to upload."); }
    const companyId = String(form.get("companyId") ?? "");
    const itemId = String(form.get("itemId") ?? "");
    const uploadId = String(form.get("uploadId") ?? "");
    const photo = form.get("photo");
    if (![companyId, itemId, uploadId].every((id) => uuid.test(id)))
      throw new ItemCreateError("Choose an item and photo to upload.");
    if (!(photo instanceof File) || !photo.size || photo.size > MAX_PRODUCT_PHOTO_BYTES)
      throw new ItemCreateError("Choose photos up to 3 MB each.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
      throw new ItemCreateError("Choose JPG, PNG or WebP photos.");
    try {
      const saved = await appendItemPhoto(photo, companyId, itemId, uploadId);
      return NextResponse.json(saved, { status: 201, headers });
    } finally {
      // A retry may be finishing a partially completed upload. Refresh those changes too.
      try { revalidateTag("catalogue"); revalidatePath("/", "layout"); } catch { /* Cache expiry is the fallback. */ }
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: error instanceof ItemCreateError ? error.status : 503, headers });
  }
}
