import { MAX_PRODUCT_PHOTO_BYTES, MAX_PRODUCT_PHOTO_SOURCE_BYTES } from "./item-fields";

/** Prepare one original at a time; the queue retains only the smaller upload file. */
export function prepareProductPhoto(file: File, signal?: AbortSignal): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.size || file.size > MAX_PRODUCT_PHOTO_SOURCE_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Choose JPG, PNG or WebP photos up to 20 MB each."));
      return;
    }

    let finished = false;
    let bitmap: ImageBitmap | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: File) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      bitmap?.close();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new Error("Photo preparation cancelled."));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => finish(new Error("This photo took too long to prepare. Select it again to retry.")), 30000);

    const prepare = async () => {
      const decoded = await createImageBitmap(file, { imageOrientation: "from-image" });
      // Decoding cannot be cancelled; release a bitmap that arrives after close/timeout.
      if (finished) { decoded.close(); return; }
      bitmap = decoded;
      if (!bitmap.width || !bitmap.height) throw new Error("Invalid dimensions");
      // Keep an already small original to avoid an unnecessary encoding pass.
      if (Math.max(bitmap.width, bitmap.height) <= 1800 && file.size <= MAX_PRODUCT_PHOTO_BYTES) {
        finish(undefined, file);
        return;
      }
      canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
      let width = Math.max(1, Math.round(bitmap.width * scale));
      let height = Math.max(1, Math.round(bitmap.height * scale));
      for (let attempt = 0; attempt < 5; attempt++) {
        canvas.width = width;
        canvas.height = height;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((done) => canvas!.toBlob(done, "image/webp", 0.92));
        if (finished) return;
        if (!blob?.size) throw new Error("Image encoding failed");
        if (blob.size <= MAX_PRODUCT_PHOTO_BYTES && ["image/webp", "image/png", "image/jpeg"].includes(blob.type)) {
          const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
          finish(undefined, new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, {
            type: blob.type,
            lastModified: file.lastModified,
          }));
          return;
        }
        // PNG fallback can be larger when the browser cannot encode WebP.
        width = Math.max(1, Math.floor(width * 0.75));
        height = Math.max(1, Math.floor(height * 0.75));
      }
      finish(new Error("This photo could not be made small enough to upload. Try another copy."));
    };
    void prepare().catch(() => finish(new Error("This photo could not be read. Choose a valid JPG, PNG or WebP image.")));
  });
}
