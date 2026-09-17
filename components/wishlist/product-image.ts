// Match ProductCard's catalogue image selection without changing the shared card.
export function getMainProductImage(images: string[] = []): string {
  for (const image of images) {
    const value = image?.trim();
    if (!value || value.toLowerCase().includes("/private/files/")) continue;
    let cleanPath = value;
    try { cleanPath = decodeURIComponent(value); } catch { /* Keep malformed URLs unchanged. */ }
    cleanPath = cleanPath.split(/[?#]/)[0].toLowerCase();
    if (/\.(mp4|webm|ogg|mov|m4v)$/.test(cleanPath) || /youtube\.com\/(embed|watch|shorts)|youtu\.be\/|vimeo\.com\//i.test(value)) continue;
    if (!/\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/.test(cleanPath) &&
      !value.includes("/storage/v1/object/public/") && !value.includes("/files/") &&
      !value.startsWith("/") && value.startsWith("http")) continue;
    if (/^https?:\/\//.test(value) || value.startsWith("/")) return value;
    return `/products/${value}`;
  }
  return "";
}
