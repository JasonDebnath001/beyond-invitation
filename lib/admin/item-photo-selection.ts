import { normalise, type AdminLibraryItem } from "./item-fields";

export const MAX_PHOTO_DOWNLOAD_ITEMS = 200;
export const MAX_PHOTO_DOWNLOAD_INPUT = 30000;

export type PhotoDownloadIssue = { identifier: string; message: string };
export type ItemPhotoDownloadData = {
  items: { id: string; designNo: string; code: string; images: string[] }[];
  issues: PhotoDownloadIssue[];
};

/** Preserve leading zeroes and spaces inside codes, including Excel-pasted columns. */
export function parsePhotoIdentifiers(input: string): string[] {
  const seen = new Set<string>();
  return input.split(/[,;\r\n\t]+/).map((value) => value.trim()).filter((value) => {
    const key = normalise(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Both identifiers are exact matches, ignoring case; ambiguous codes never guess. */
export function selectPhotoItems(items: AdminLibraryItem[], identifiers: string[]) {
  const index = new Map<string, AdminLibraryItem[]>();
  for (const item of items) {
    for (const key of new Set([normalise(item.designNo), normalise(item.code)])) {
      if (key) index.set(key, [...(index.get(key) ?? []), item]);
    }
  }
  const selected = new Map<string, AdminLibraryItem>();
  const issues: PhotoDownloadIssue[] = [];
  for (const identifier of identifiers) {
    const matches = index.get(normalise(identifier)) ?? [];
    if (!matches.length)
      issues.push({ identifier, message: "Not found in the selected company." });
    else if (matches.length > 1)
      issues.push({ identifier, message: "Matches multiple items. Use a unique design number or item code." });
    else selected.set(matches[0].id, matches[0]);
  }
  return { items: [...selected.values()], issues };
}

/** Main photo first, then every unique gallery photo; galleries also contain videos. */
export function itemPhotoUrls(images: string[]): string[] {
  return [...new Set(images.map((url) => url.trim()).filter(Boolean))].filter((url) => {
    try {
      const source = new URL(url, "https://catalogue.invalid");
      return ["http:", "https:"].includes(source.protocol) &&
        /\.(?:jpe?g|jfif|png|webp|avif|gif|bmp|svg)$/i.test(decodeURIComponent(source.pathname));
    } catch { return false; }
  });
}
