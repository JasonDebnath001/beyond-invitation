import "server-only";
import { createHash, randomUUID } from "node:crypto";
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
  const { data: company, error: companyError } = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new ItemCreateError("Choose an active company.", 404);
  const { data: item, error: itemError } = await db
    .from("items")
    .select("id,name,image_url")
    .eq("id", itemId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item)
    throw new ItemCreateError(
      "This item is no longer available in the selected company.",
      404,
    );

  const readPhoto = async () => {
    const { data, error } = await db
      .from("item_images")
      .select("id,item_id,company_id,image_url,is_deleted")
      .eq("id", uploadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (
      data &&
      (data.item_id !== itemId ||
        data.company_id !== companyId ||
        data.is_deleted)
    )
      throw new ItemCreateError(
        "This upload is no longer available. Select the photo again.",
        409,
      );
    return data;
  };
  let saved = await readPhoto();
  if (!saved) {
    const bytes = await prepareItemPhoto(file);
    const { data: last, error: orderError } = await db
      .from("item_images")
      .select("sort_order")
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    const uploaded = await storeItemPhoto(
      bytes,
      companyId,
      itemId,
      db,
      uploadId,
    );
    const record = {
      id: uploadId,
      company_id: companyId,
      item_id: itemId,
      image_url: uploaded.url,
      thumb_url: uploaded.url,
      sort_order: (last?.sort_order ?? 0) + 1,
      source: "manual",
      is_deleted: false,
    };
    const { error } = await db.from("item_images").insert(record);
    if (error && error.code !== "23505")
      throw new Error(`Could not save this photo: ${error.message}`);
    saved = error ? await readPhoto() : record;
    if (!saved)
      throw new Error(
        "Could not confirm this photo was saved. Retry the upload.",
      );
  }
  // An existing main photo is never replaced by a gallery upload, including races.
  if (!item.image_url) {
    const { error } = await db
      .from("items")
      .update({
        image_url: saved.image_url,
        thumb_url: saved.image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("company_id", companyId)
      .or("image_url.is.null,image_url.eq.");
    if (error)
      throw new Error(
        `Photo added, but the main photo could not be set. Retry to finish: ${error.message}`,
      );
  }
  return { id: saved.id, url: saved.image_url };
}

/** Resolve only objects in this project's item_images bucket, never arbitrary URLs. */
export function itemPhotoStoragePath(
  url: string,
  publicBase: string,
): string | undefined {
  try {
    const base = new URL(publicBase);
    const candidate = new URL(url);
    if (candidate.origin !== base.origin) return;
    const prefix = base.pathname.slice(0, base.pathname.lastIndexOf("/") + 1);
    const pathname = candidate.pathname.replace(
      /\/storage\/v1\/(?:object|render\/image)\/(?:sign|authenticated|public)\//,
      "/storage/v1/object/public/",
    );
    if (!pathname.startsWith(prefix)) return;
    const path = decodeURIComponent(pathname.slice(prefix.length));
    if (
      !path ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    )
      return;
    return path;
  } catch {
    return;
  }
}

/** Replace in place; deleted gallery snapshots keep cleanup retryable across requests. */
export async function replaceItemPhoto(
  file: File,
  companyId: string,
  itemId: string,
  uploadId: string,
  previousUrl: string,
  db = getSupabaseAdminClient(),
) {
  const bucket = db.storage.from("item_images");
  let filename = previousUrl.split(/[?#]/)[0].split("/").pop() ?? "";
  try { filename = decodeURIComponent(filename); } catch { /* Preserve malformed legacy URLs as-is. */ }
  // Storefront galleries also sort by numbered filename suffixes.
  const position = filename.match(/_(\d+)\.[^.]+$/)?.[1];
  const storageId = position ? `${uploadId}_${position}` : uploadId;
  const path = `dashboard/${companyId}/${itemId}/${storageId}.webp`;
  const url = bucket.getPublicUrl(path).data.publicUrl;
  const { data: company, error: companyError } = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new ItemCreateError("Choose an active company.", 404);

  const readItem = async () => {
    const { data, error } = await db
      .from("items")
      .select("id,image_url,thumb_url")
      .eq("id", itemId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)
      throw new ItemCreateError(
        "This item is no longer available in the selected company.",
        404,
      );
    return data;
  };
  const readGallery = async () => {
    const { data, error } = await db
      .from("item_images")
      .select("id,image_url,thumb_url,is_deleted,sort_order")
      .eq("item_id", itemId)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const item = await readItem();
  const gallery = await readGallery();
  // This upload ID is also the cleanup receipt. Its URLs come only from database rows.
  const { data: receipt, error: receiptError } = await db
    .from("item_images")
    .select("id,item_id,company_id,image_url,is_deleted")
    .eq("id", uploadId)
    .maybeSingle();
  if (receiptError) throw new Error(receiptError.message);
  if (
    receipt &&
    (receipt.item_id !== itemId ||
      receipt.company_id !== companyId ||
      receipt.image_url !== previousUrl ||
      !receipt.is_deleted)
  )
    throw new ItemCreateError(
      "This replacement is no longer available. Reopen the item and select the photo again.",
      409,
    );
  const originals = gallery.filter(
    (photo) => !photo.is_deleted && photo.image_url === previousUrl,
  );
  const hasReplacement =
    item.image_url === url ||
    gallery.some((photo) => !photo.is_deleted && photo.image_url === url);
  if (!receipt && hasReplacement) return { id: uploadId, url }; // Lost success response; cleanup already finished.
  if (!receipt && item.image_url !== previousUrl && !originals.length)
    throw new ItemCreateError(
      "This photo changed since you opened it. Reopen the item before replacing it.",
      409,
    );
  if (url === previousUrl)
    throw new ItemCreateError("Select a new replacement photo.", 409);

  await storeItemPhoto(
    await prepareItemPhoto(file),
    companyId,
    itemId,
    db,
    storageId,
  );
  const snapshot = (id: string, thumbnail: string | null) => ({
    id,
    company_id: companyId,
    item_id: itemId,
    image_url: previousUrl,
    thumb_url: thumbnail,
    source: "manual",
    is_deleted: true,
    sort_order: 0,
  });
  if (!receipt) {
    // Keep every original thumbnail until storage deletion succeeds. These rows are
    // excluded from both the editor and the storefront by is_deleted.
    const snapshots = originals.map((photo) => {
      const hash = createHash("sha256")
        .update(`${uploadId}:${photo.id}`)
        .digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      return snapshot(id, photo.thumb_url);
    });
    snapshots.push(
      snapshot(
        uploadId,
        item.image_url === previousUrl ? item.thumb_url : null,
      ),
    );
    const { error } = await db
      .from("item_images")
      .upsert(snapshots, { onConflict: "id", ignoreDuplicates: true });
    if (error)
      throw new Error(
        `Could not prepare the replacement. Retry to finish: ${error.message}`,
      );
  }

  if (item.image_url === previousUrl) {
    const { data, error } = await db
      .from("items")
      .update({
        image_url: url,
        thumb_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("company_id", companyId)
      .eq("image_url", previousUrl)
      .select("id");
    if (error)
      throw new Error(
        `Could not replace the main photo. Retry to finish: ${error.message}`,
      );
    if (!data?.length && (await readItem()).image_url !== url)
      throw new ItemCreateError(
        "The main photo changed while saving. Reopen the item before replacing it.",
        409,
      );
  }
  const { error: galleryError } = await db
    .from("item_images")
    .update({ image_url: url, thumb_url: url })
    .eq("company_id", companyId)
    .eq("item_id", itemId)
    .eq("image_url", previousUrl)
    .eq("is_deleted", false);
  if (galleryError)
    throw new Error(
      `Could not replace the gallery photo. Retry to finish: ${galleryError.message}`,
    );

  const current = await readItem();
  const currentGallery = await readGallery();
  if (
    current.image_url !== url &&
    !currentGallery.some(
      (photo) => !photo.is_deleted && photo.image_url === url,
    )
  )
    throw new ItemCreateError(
      "This photo changed while saving. Reopen the item before replacing it.",
      409,
    );
  const snapshots = currentGallery.filter(
    (photo) => photo.is_deleted && photo.image_url === previousUrl,
  );
  const oldUrls = [
    ...new Set(
      snapshots
        .flatMap((photo) => [photo.image_url, photo.thumb_url])
        .filter((value): value is string => !!value),
    ),
  ];
  // A gallery image can also be the item's thumbnail without being its main image.
  if (current.thumb_url && oldUrls.includes(current.thumb_url)) {
    const { error } = await db
      .from("items")
      .update({ thumb_url: url, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("company_id", companyId)
      .eq("thumb_url", current.thumb_url);
    if (error)
      throw new Error(
        `Could not replace the thumbnail. Retry to finish: ${error.message}`,
      );
  }

  const publicBase = bucket.getPublicUrl("__path__").data.publicUrl;
  const paths = [
    ...new Set(
      oldUrls
        .map((old) => itemPhotoStoragePath(old, publicBase))
        .filter((value): value is string => !!value && value !== path),
    ),
  ];
  const removable: string[] = [];
  for (const oldPath of paths) {
    const aliases = [
      ...new Set([
        bucket.getPublicUrl(oldPath).data.publicUrl,
        ...oldUrls.filter(
          (old) => itemPhotoStoragePath(old, publicBase) === oldPath,
        ),
      ]),
    ];
    let shared = false;
    for (const alias of aliases) {
      for (const table of ["items", "item_images"]) {
        for (const column of ["image_url", "thumb_url"]) {
          let query = db.from(table).select("id").eq(column, alias).limit(1);
          if (table === "item_images") query = query.eq("is_deleted", false);
          const { data, error } = await query;
          if (error)
            throw new Error(
              `Could not check old photo usage. Retry to finish: ${error.message}`,
            );
          if (data?.length) shared = true;
        }
      }
    }
    // A file still used by another item must remain available to that item.
    if (!shared) removable.push(oldPath);
  }
  if (removable.length) {
    const { error } = await bucket.remove(removable);
    if (error)
      throw new Error(
        `Replacement saved, but old photos could not be deleted. Retry to finish: ${error.message}`,
      );
  }
  if (snapshots.length) {
    const { error } = await db
      .from("item_images")
      .delete()
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("is_deleted", true)
      .in(
        "id",
        snapshots.map((photo) => photo.id),
      );
    if (error)
      throw new Error(
        `Replacement saved, but old photo records could not be deleted. Retry to finish: ${error.message}`,
      );
  }
  return { id: uploadId, url };
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
