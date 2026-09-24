export type PdfPhotoLoader = (url: string, signal?: AbortSignal) => Promise<Uint8Array>;
const PHOTO_SIZE = 1000;
const PHOTO_QUALITY = 0.72;

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new Error("PDF download cancelled.");
}

/** Leave external, local and signed URLs alone; only public Storage URLs transform. */
export function transformedPdfPhotoUrl(url: string): string {
  try {
    const source = new URL(url);
    if (!/\.supabase\.(?:co|in)$/i.test(source.hostname) ||
      !source.pathname.startsWith("/storage/v1/object/public/")) return url;
    source.pathname = source.pathname.replace("/object/public/", "/render/image/public/");
    source.searchParams.set("width", String(PHOTO_SIZE));
    source.searchParams.set("quality", "72");
    return source.href;
  } catch { return url; }
}

export function canvasBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Photo encoding failed.")), type, quality,
  ));
}

function dimensions(width: number, height: number) {
  if (!width || !height) throw new Error("Invalid photo dimensions.");
  const scale = Math.min(1, PHOTO_SIZE / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function bitmapPhoto(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, {
    signal, cache: "force-cache", credentials: "omit", referrerPolicy: "no-referrer",
    headers: { Accept: "image/webp,image/*;q=0.8" },
  });
  if (!response.ok) throw new Error("Photo unavailable.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Not a photo.");
  checkCancelled(signal);
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  let canvas: OffscreenCanvas | undefined;
  try {
    checkCancelled(signal);
    const [width, height] = dimensions(bitmap.width, bitmap.height);
    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot prepare photos in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const encoded = await canvas.convertToBlob({ type: "image/jpeg", quality: PHOTO_QUALITY });
    checkCancelled(signal);
    if (encoded.type !== "image/jpeg") throw new Error("JPEG encoding unavailable.");
    return new Uint8Array(await encoded.arrayBuffer());
  } finally {
    bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

/** Compatibility path: still use asynchronous encoding and bytes, never base64. */
function legacyPhoto(url: string, signal: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const photo = new Image();
    let canvas: HTMLCanvasElement | undefined;
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      photo.onload = null;
      photo.onerror = null;
      photo.src = "";
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };
    const fail = () => { cleanup(); reject(new Error("Photo unavailable.")); };
    const abort = () => { cleanup(); reject(new Error("PDF download cancelled.")); };
    photo.crossOrigin = "anonymous";
    photo.referrerPolicy = "no-referrer";
    photo.onerror = fail;
    photo.onload = () => {
      void (async () => {
        checkCancelled(signal);
        const [width, height] = dimensions(photo.naturalWidth, photo.naturalHeight);
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Cannot prepare photos in this browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(photo, 0, 0, width, height);
        const blob = await canvasBlob(canvas, "image/jpeg", PHOTO_QUALITY);
        checkCancelled(signal);
        if (blob.type !== "image/jpeg") throw new Error("JPEG encoding unavailable.");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        cleanup();
        resolve(bytes);
      })().catch(fail);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    photo.src = url;
  });
}

async function photoAttempt(url: string, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  if (parentSignal?.aborted) abort();
  const timer = setTimeout(abort, 10000);
  let rejectOnAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(new Error(parentSignal?.aborted ? "PDF download cancelled." : "Photo took too long to load."));
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
    if (controller.signal.aborted) rejectOnAbort();
  });
  try {
    const modern = typeof createImageBitmap === "function" &&
      typeof OffscreenCanvas !== "undefined" && typeof OffscreenCanvas.prototype.convertToBlob === "function";
    return await Promise.race([
      modern ? bitmapPhoto(url, controller.signal) : legacyPhoto(url, controller.signal), cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectOnAbort);
  }
}

export const loadPdfPhoto: PdfPhotoLoader = async (url, signal) => {
  const source = new URL(url, window.location.origin);
  if (!["http:", "https:"].includes(source.protocol)) throw new Error("Photo unavailable.");
  const original = source.href;
  const transformed = transformedPdfPhotoUrl(original);
  for (const candidate of [...new Set([transformed, original])]) {
    if (signal?.aborted) throw new Error("PDF download cancelled.");
    try { return await photoAttempt(candidate, signal); }
    catch (error) {
      if (signal?.aborted) throw new Error("PDF download cancelled.");
      if (candidate === original) throw error;
    }
  }
  throw new Error("Photo unavailable.");
};
