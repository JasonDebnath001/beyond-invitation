import { MAX_PRODUCT_VIDEO_BYTES, productVideoType } from "./item-video-fields";

type VideoUpload = { companyId: string; itemId: string; uploadId: string; expectedVideoUrl: string };

async function videoRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch("/api/admin/items/videos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save the video. Please retry.");
    return result as { url: string; saved?: boolean; uploaded?: boolean; signedUrl?: string };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(signal?.aborted ? "Video upload cancelled." : "Video request timed out. Please retry.");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}

/** Video bytes go straight to Storage, avoiding the application server's body limit. */
function uploadSignedVideo(url: string, file: File, contentType: string, signal?: AbortSignal, onProgress?: (message: string) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const abort = () => { request.abort(); fail("Video upload cancelled."); };
    request.open("PUT", url);
    request.timeout = 300000;
    request.setRequestHeader("Content-Type", contentType);
    request.setRequestHeader("cache-control", "max-age=31536000");
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(`Uploading video... ${Math.round(event.loaded / event.total * 100)}%`);
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) { fail("Could not upload the video. Please retry."); return; }
      cleanup(); resolve();
    };
    request.onerror = () => fail("Video upload interrupted. Check your connection and retry.");
    request.ontimeout = () => fail("Video upload timed out. Please retry.");
    request.onabort = () => fail("Video upload cancelled.");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    request.send(file);
  });
}

export async function uploadItemVideo(
  input: VideoUpload,
  file: File,
  options: { signal?: AbortSignal; onProgress?: (message: string) => void } = {},
) {
  const contentType = productVideoType(file.name, file.type);
  if (!contentType || !file.size || file.size > MAX_PRODUCT_VIDEO_BYTES)
    throw new Error("Choose an MP4 or WebM video up to 50 MB.");
  const body = { ...input, size: file.size, contentType };
  options.onProgress?.("Preparing video upload...");
  const prepared = await videoRequest({ ...body, action: "prepare" }, options.signal);
  if (prepared.saved) return prepared;
  if (!prepared.uploaded) {
    if (!prepared.signedUrl) throw new Error("Could not prepare the video upload. Please retry.");
    await uploadSignedVideo(prepared.signedUrl, file, contentType, options.signal, options.onProgress);
  }
  options.onProgress?.("Saving video to this item...");
  return videoRequest({ ...body, action: "complete" }, options.signal);
}
