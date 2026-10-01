import JSZip from "jszip";
import type { ItemPhotoDownloadData, PhotoDownloadIssue } from "./item-photo-selection";

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
type PhotoFile = { bytes: Uint8Array; extension: string };
type PhotoLoader = (url: string, signal: AbortSignal) => Promise<PhotoFile>;

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Photo download cancelled.");
}

/** A safe folder component on Windows too, with no ZIP traversal or reserved names. */
export function photoFolderName(value: string) {
  const name = value.trim().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "_")
    .replace(/^\.+/, "").slice(0, 80).replace(/[. ]+$/, "") || "design";
  return /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/avif": "avif", "image/gif": "gif", "image/bmp": "bmp", "image/svg+xml": "svg",
};

/** Download the stored bytes without converting or reducing image quality. */
export const loadOriginalPhoto: PhotoLoader = async (url, parentSignal) => {
  const source = new URL(url, window.location.origin);
  if (!["https:", "http:"].includes(source.protocol)) throw new Error("Invalid photo URL.");
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(20000)]);
  try {
    checkCancelled(signal);
    const response = await fetch(source.href, {
      signal, credentials: "omit", referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`Photo unavailable (HTTP ${response.status}).`);
    const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const extension = mimeExtensions[mime ?? ""] ||
      decodeURIComponent(source.pathname).match(/\.(jpe?g|jfif|png|webp|avif|gif|bmp|svg)$/i)?.[1].toLowerCase();
    if (!extension || (mime && !mime.startsWith("image/") && mime !== "application/octet-stream"))
      throw new Error("The photo URL did not return an image.");
    if (Number(response.headers.get("content-length")) > MAX_PHOTO_BYTES) {
      await response.body?.cancel();
      throw new Error("Photo exceeds the 25 MB download limit.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The photo is empty.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        checkCancelled(signal);
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PHOTO_BYTES) throw new Error("Photo exceeds the 25 MB download limit.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!size) throw new Error("The photo is empty.");
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { bytes, extension };
  } catch (error) {
    checkCancelled(parentSignal);
    if (signal.aborted) throw new Error("Photo took too long to download.");
    throw error;
  }
};

export async function createItemPhotoZip(data: ItemPhotoDownloadData, options: {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  loadPhoto?: PhotoLoader;
} = {}) {
  checkCancelled(options.signal);
  const zip = new JSZip();
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const loadPhoto = options.loadPhoto ?? loadOriginalPhoto;
  const folders = new Set<string>();
  const tasks = data.items.flatMap((item) => {
    const base = photoFolderName(item.designNo || item.code);
    let folder = base;
    let suffix = 2;
    while (folders.has(folder.toLowerCase())) folder = `${base}-${suffix++}`;
    folders.add(folder.toLowerCase());
    return item.images.map((url, index) => ({ item, url, index, folder }));
  });
  const issues: PhotoDownloadIssue[] = [...data.issues];
  const exportedItems = new Set<string>();
  let next = 0, completed = 0, photoCount = 0, totalBytes = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, async () => {
      while (next < tasks.length) {
        checkCancelled(signal);
        const task = tasks[next++];
        let photo: PhotoFile;
        try { photo = await loadPhoto(task.url, signal); }
        catch (error) {
          checkCancelled(signal);
          issues.push({ identifier: task.item.designNo || task.item.code,
            message: `Photo ${task.index + 1}: ${(error as Error).message || "Could not download this photo."}` });
          completed++;
          options.onProgress?.(`Downloading photos ${completed} of ${tasks.length}...`);
          continue;
        }
        checkCancelled(signal);
        totalBytes += photo.bytes.byteLength;
        if (totalBytes > MAX_ZIP_BYTES)
          throw new Error("These photos exceed 200 MB. Download fewer design numbers at a time.");
        zip.file(`${task.folder}/${task.folder}-${String(task.index + 1).padStart(2, "0")}.${photo.extension}`, photo.bytes);
        photoCount++;
        exportedItems.add(task.item.id);
        completed++;
        options.onProgress?.(`Downloading photos ${completed} of ${tasks.length}...`);
      }
    }));
    checkCancelled(signal);
    if (!photoCount) return { bytes: null, photoCount, itemCount: 0, issues };
    if (issues.length) zip.file("download-report.txt", [
      `Downloaded ${photoCount} photo(s) for ${exportedItems.size} design(s).`,
      "", "The following numbers or photos were skipped:",
      ...issues.map((issue) => `${issue.identifier}: ${issue.message}`),
    ].join("\r\n"));
    options.onProgress?.("Preparing ZIP...");
    // Photos are already compressed. STORE preserves bytes and avoids extra CPU work.
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" }, () => checkCancelled(signal));
    checkCancelled(signal);
    return { bytes, photoCount, itemCount: exportedItems.size, issues };
  } finally { controller.abort(); }
}
