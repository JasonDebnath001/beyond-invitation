import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ItemCreateError } from "./item-create";
import { MAX_PRODUCT_VIDEO_BYTES } from "./item-video-fields";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type VideoRequest = {
  action: "prepare" | "complete";
  companyId: string;
  itemId: string;
  uploadId: string;
  contentType: "video/mp4" | "video/webm";
  size: number;
  expectedVideoUrl: string;
};

export function parseItemVideoRequest(body: unknown): VideoRequest {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ItemCreateError("Choose an item and video to upload.");
  const input = body as Record<string, unknown>;
  if (!["prepare", "complete"].includes(String(input.action)) ||
    ![input.companyId, input.itemId, input.uploadId].every((id) => typeof id === "string" && uuid.test(id)))
    throw new ItemCreateError("Choose an item and video to upload.");
  if (!["video/mp4", "video/webm"].includes(String(input.contentType)))
    throw new ItemCreateError("Choose an MP4 or WebM video.");
  if (!Number.isSafeInteger(input.size) || Number(input.size) <= 0 || Number(input.size) > MAX_PRODUCT_VIDEO_BYTES)
    throw new ItemCreateError("Choose a video up to 50 MB.", 413);
  if (typeof input.expectedVideoUrl !== "string" || input.expectedVideoUrl.length > 2000)
    throw new ItemCreateError("Refresh the item and try again.");
  return input as VideoRequest;
}

export function videoSignatureMatches(bytes: Uint8Array, type: VideoRequest["contentType"]) {
  const buffer = Buffer.from(bytes);
  if (type === "video/webm")
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && buffer.includes(Buffer.from("webm"));
  if (buffer.length < 16 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const boxSize = buffer.readUInt32BE(0);
  if (boxSize < 16 || boxSize > buffer.length) return false;
  // Exclude HEIF/AVIF images, which also use an ftyp container.
  const videoBrand = /^(?:isom|iso[2-9]|mp4[12]|avc1|dash|M4V |MSNV)$/;
  if (videoBrand.test(buffer.toString("ascii", 8, 12))) return true;
  for (let offset = 16; offset + 4 <= boxSize; offset += 4)
    if (videoBrand.test(buffer.toString("ascii", offset, offset + 4))) return true;
  return false;
}

/** Fetch only a small prefix from our own server-derived storage URL. */
async function videoPrefix(url: string) {
  const response = await fetch(url, {
    headers: { Range: "bytes=0-4095" }, redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body) throw new Error("Could not verify the uploaded video. Please retry.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 4096) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, 4096 - length);
      chunks.push(chunk);
      length += chunk.length;
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

async function readVideoItem(input: VideoRequest, db: SupabaseClient) {
  const { data: company, error: companyError } = await db.from("companies")
    .select("id").eq("id", input.companyId).eq("is_active", true).maybeSingle();
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new ItemCreateError("Choose an active company.", 404);
  const { data: item, error } = await db.from("items").select("id,video_url")
    .eq("id", input.itemId).eq("company_id", input.companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new ItemCreateError("This item is no longer available in this company.", 404);
  return item;
}

export async function saveItemVideo(
  input: VideoRequest,
  db = getSupabaseAdminClient(),
  readPrefix = videoPrefix,
) {
  const item = await readVideoItem(input, db);
  const bucket = db.storage.from("item_images");
  const extension = input.contentType === "video/mp4" ? "mp4" : "webm";
  const path = `dashboard/${input.companyId}/${input.itemId}/videos/${input.uploadId}.${extension}`;
  const url = bucket.getPublicUrl(path).data.publicUrl;
  // Stable IDs make a retry after a lost save response harmless.
  if (item.video_url === url) return { url, saved: true };
  if ((item.video_url ?? "") !== input.expectedVideoUrl)
    throw new ItemCreateError("This item's video changed. Close the editor, refresh and try again.", 409);

  if (input.action === "prepare") {
    const { data: exists, error: existsError } = await bucket.exists(path);
    // Storage returns data:false with a 400/404 error for a missing object.
    if (existsError && exists !== false) throw new Error("Could not check the video upload. Please retry.");
    if (exists) return { url, uploaded: true };
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(`Could not prepare the video upload: ${error.message}`);
    return { url, signedUrl: data.signedUrl };
  }

  const { data: info, error: infoError } = await bucket.info(path);
  if (infoError || !info) throw new ItemCreateError("The video upload is incomplete. Please retry.", 409);
  if (Number(info.size) !== input.size || info.contentType !== input.contentType)
    throw new ItemCreateError("The uploaded video does not match the selected file. Select it again.");
  if (!videoSignatureMatches(await readPrefix(url), input.contentType))
    throw new ItemCreateError("This file is not a valid MP4 or WebM video. Choose another file.");

  let update = db.from("items").update({ video_url: url, video_source: "upload" })
    .eq("id", input.itemId).eq("company_id", input.companyId);
  update = item.video_url == null ? update.is("video_url", null) : update.eq("video_url", item.video_url);
  const { data: saved, error } = await update.select("id").maybeSingle();
  if (error) throw new Error("Video uploaded, but could not be attached to the item. Retry to finish saving.");
  if (!saved) {
    const latest = await readVideoItem(input, db);
    if (latest.video_url !== url)
      throw new ItemCreateError("This item's video changed while saving. Refresh and try again.", 409);
  }
  return { url, saved: true };
}
