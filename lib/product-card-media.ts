function isPrivateFileUrl(src?: string) {
  if (!src) return false;

  const value = src.trim().toLowerCase();

  return (
    value.startsWith("/private/files/") || value.includes("/private/files/")
  );
}

function getImageSrc(img: string) {
  if (!img) return "";

  const value = img.trim();

  if (!value) return "";

  if (isPrivateFileUrl(value)) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/products/${value}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCleanPath(src: string) {
  return safeDecode(src.trim()).split("?")[0].split("#")[0].toLowerCase();
}

function isYoutubeUrl(src: string) {
  const value = src.toLowerCase();

  return (
    value.includes("youtube.com/embed/") ||
    value.includes("youtube.com/watch") ||
    value.includes("youtube.com/shorts/") ||
    value.includes("youtu.be/")
  );
}

function isVimeoUrl(src: string) {
  return src.toLowerCase().includes("vimeo.com/");
}

function isDirectVideo(src: string) {
  const cleanPath = getCleanPath(src);

  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanPath);
}

function isVideoLikeUrl(src: string) {
  return isYoutubeUrl(src) || isVimeoUrl(src) || isDirectVideo(src);
}

function isImageLikeUrl(src: string) {
  const value = src.trim();

  if (!value) return false;
  if (isPrivateFileUrl(value)) return false;
  if (isVideoLikeUrl(value)) return false;

  const cleanPath = getCleanPath(value);

  return (
    /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)$/i.test(cleanPath) ||
    value.includes("/storage/v1/object/public/") ||
    value.startsWith("/files/") ||
    value.includes("/files/") ||
    value.startsWith("/") ||
    !value.startsWith("http")
  );
}

export function getProductCardImages(images: string[] | undefined) {
  // The catalogue supplies the primary image first, followed by gallery order.

  const cleanImages = Array.from(
    new Set(
      (images ?? [])
        .map((image) => image?.trim())
        .filter((image): image is string => Boolean(image)),
    ),
  ).filter(isImageLikeUrl);

  return cleanImages.map(getImageSrc).filter(Boolean);
}

