import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { MAX_PRODUCT_PHOTO_BYTES } from "./item-fields";
import { ItemCreateError } from "./item-create";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function prepareItemPhoto(file: File): Promise<Buffer> {
  if (!file.size || file.size > MAX_PRODUCT_PHOTO_BYTES)
    throw new ItemCreateError("Choose a photo up to 3 MB.", 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new ItemCreateError("Choose a JPG, PNG or WebP photo.");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, {
      limitInputPixels: 25000000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Unsupported image");
    // Decode the actual image, orient it, strip metadata and keep storefront files small.
    return await image
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw new ItemCreateError(
      "This photo could not be read. Choose a valid JPG, PNG or WebP image up to 25 megapixels.",
    );
  }
}

export async function storeItemPhoto(
  bytes: Buffer,
  companyId: string,
  itemId: string,
  db = getSupabaseAdminClient(),
  uploadId?: string,
) {
  const bucket = db.storage.from("item_images");
  const path = `dashboard/${companyId}/${itemId}/${uploadId ?? randomUUID()}.webp`;
  const { error } = await bucket.upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error && !(uploadId && String(error.statusCode) === "409"))
    throw new Error(`Could not upload the photo: ${error.message}`);
  return { path, url: bucket.getPublicUrl(path).data.publicUrl };
}

/** One stable upload ID per selected file makes retries safe after a lost response. */
export async function appendItemPhoto(
  file: File,
  companyId: string,
  itemId: string,
  uploadId: string,
  db = getSupabaseAdminClient(),
) {
  const { data: company, error: companyError } = await db.from("companies").select("id").eq("id", companyId).eq("is_active", true).maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new ItemCreateError("Choose an active company.", 404);
  const { data: item, error: itemError } = await db.from("items").select("id,name,image_url").eq("id", itemId).eq("company_id", companyId).maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new ItemCreateError("This item is no longer available in the selected company.", 404);

  const readPhoto = async () => {
    const { data, error } = await db.from("item_images").select("id,item_id,company_id,image_url,is_deleted").eq("id", uploadId).maybeSingle();
    if (error) throw new Error(error.message);
    if (data && (data.item_id !== itemId || data.company_id !== companyId || data.is_deleted))
      throw new ItemCreateError("This upload is no longer available. Select the photo again.", 409);
    return data;
  };
  let saved = await readPhoto();
  if (!saved) {
    const bytes = await prepareItemPhoto(file);
    const { data: last, error: orderError } = await db.from("item_images").select("sort_order")
      .eq("company_id", companyId).eq("item_id", itemId).eq("is_deleted", false)
      .order("sort_order", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (orderError) throw new Error(orderError.message);
    const uploaded = await storeItemPhoto(bytes, companyId, itemId, db, uploadId);
    const record = {
      id: uploadId, company_id: companyId, item_id: itemId,
      image_url: uploaded.url, thumb_url: uploaded.url,
      sort_order: (last?.sort_order ?? 0) + 1, source: "manual", is_deleted: false,
    };
    const { error } = await db.from("item_images").insert(record);
    if (error && error.code !== "23505") throw new Error(`Could not save this photo: ${error.message}`);
    saved = error ? await readPhoto() : record;
    if (!saved) throw new Error("Could not confirm this photo was saved. Retry the upload.");
  }
  // An existing main photo is never replaced by a gallery upload, including races.
  if (!item.image_url) {
    const { error } = await db.from("items").update({ image_url: saved.image_url, thumb_url: saved.image_url, updated_at: new Date().toISOString() })
      .eq("id", itemId).eq("company_id", companyId).or("image_url.is.null,image_url.eq.");
    if (error) throw new Error(`Photo added, but the main photo could not be set. Retry to finish: ${error.message}`);
  }
  return { id: saved.id, url: saved.image_url };
}

export async function discardItemPhoto(
  path: string,
  db = getSupabaseAdminClient(),
) {
  // Used only when a conditional update definitively did not write this new photo.
  try {
    await db.storage.from("item_images").remove([path]);
  } catch {
    /* Best effort; never delete an existing item photo. */
  }
}
