import "server-only";
import { loadItemLibrary } from "./item-service";
import { loadItemGalleries } from "./item-gallery";
import {
  MAX_PHOTO_DOWNLOAD_INPUT,
  MAX_PHOTO_DOWNLOAD_ITEMS,
  itemPhotoUrls,
  parsePhotoIdentifiers,
  selectPhotoItems,
  type ItemPhotoDownloadData,
} from "./item-photo-selection";

export class PhotoDownloadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function loadItemPhotoDownload(body: unknown, signal: AbortSignal): Promise<ItemPhotoDownloadData> {
  if (!body || typeof body !== "object") throw new PhotoDownloadError("Enter design numbers or item codes.");
  const { companyId, identifiers: input } = body as Record<string, unknown>;
  if (typeof companyId !== "string" || !companyId.trim())
    throw new PhotoDownloadError("Choose a company for the photo download.");
  if (typeof input !== "string" || input.length > MAX_PHOTO_DOWNLOAD_INPUT)
    throw new PhotoDownloadError("The list is too large. Download fewer numbers at a time.");
  const identifiers = parsePhotoIdentifiers(input);
  if (!identifiers.length) throw new PhotoDownloadError("Enter at least one design number or item code.");
  if (identifiers.length > MAX_PHOTO_DOWNLOAD_ITEMS)
    throw new PhotoDownloadError(`Download up to ${MAX_PHOTO_DOWNLOAD_ITEMS} numbers at a time.`);
  const library = await loadItemLibrary(companyId, signal);
  const selection = selectPhotoItems(library.items, identifiers);
  const galleries = selection.items.length
    ? await loadItemGalleries(companyId, selection.items.map((item) => item.id), signal)
    : new Map<string, string[]>();
  const issues = [...selection.issues];
  const items = selection.items.map((item) => ({
    id: item.id,
    designNo: item.designNo,
    code: item.code,
    images: itemPhotoUrls([item.imageUrl, ...(galleries.get(item.id) ?? [])]),
  })).filter((item) => {
    if (item.images.length) return true;
    issues.push({ identifier: item.designNo || item.code, message: "No photos available." });
    return false;
  });
  return { items, issues };
}
