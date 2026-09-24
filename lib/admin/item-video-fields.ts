export const MAX_PRODUCT_VIDEO_BYTES = 50 * 1024 * 1024;
export const PRODUCT_VIDEO_ACCEPT = ".mp4,.webm,video/mp4,video/webm";

export function productVideoType(name: string, type: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  const expected = extension === "mp4" ? "video/mp4" : extension === "webm" ? "video/webm" : undefined;
  return expected && (!type || type === expected) ? expected : undefined;
}

export function videoSourceForUrl(value: string) {
  if (!value.trim()) return "";
  try {
    const host = new URL(value).hostname.toLowerCase();
    return /(^|\.)youtube(?:-nocookie)?\.com$/.test(host) || host === "youtu.be" ? "youtube" : "upload";
  } catch { return "upload"; }
}
