import type { ImageLoaderProps } from "next/image";

/** Resize public Supabase photos at their origin, preserving the entire image. */
export function getStorageImageUrl(src: string, width: number, quality = 80): string | null {
  try {
    const url = new URL(src);
    const prefix = "/storage/v1/object/public/";
    if (
      url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") ||
      !url.pathname.startsWith(prefix) || /\.(svg|gif)$/i.test(url.pathname) ||
      !Number.isFinite(width) || !Number.isFinite(quality)
    ) return null;

    url.pathname = url.pathname.replace(prefix, "/storage/v1/render/image/public/");
    // Supabase accepts dimensions up to 2500px. Next can offer larger DPR sizes.
    url.searchParams.set("width", String(Math.max(1, Math.min(2500, Math.round(width)))));
    url.searchParams.set("quality", String(Math.max(20, Math.min(100, Math.round(quality)))));
    // The default "cover" mode crops tall invitation photos when only width is set.
    url.searchParams.set("resize", "contain");
    url.searchParams.delete("height");
    url.searchParams.delete("download");
    return url.toString();
  } catch {
    return null;
  }
}

export function storageImageLoader({ src, width, quality }: ImageLoaderProps) {
  return getStorageImageUrl(src, width, quality ?? 80) ?? src;
}
