import { CARD_TYPES } from "@/lib/wedding-cards";
import type { AdminLibraryItem } from "./item-fields";

export type PdfCategory = {
  value: string;
  label: string;
  category: string;
  publishedOnly: boolean;
};
export type CategoryPdfData = {
  title: string;
  skippedItemCount?: number;
  items: { id: string; name: string; designNo: string; images: string[] }[];
};

/** Gallery records can contain videos as well as photos. Filter before limiting. */
export function photosForPdf(images: string[]): string[] {
  return [...new Set(images.map((url) => url.trim()).filter(Boolean))]
    .filter((url) => {
      try {
        const source = new URL(url, "https://catalogue.invalid");
        return ["http:", "https:"].includes(source.protocol) &&
          /\.(?:jpe?g|jfif|png|webp|avif|gif|bmp|svg)$/i.test(decodeURIComponent(source.pathname));
      } catch {
        return false;
      }
    })
    .slice(0, 4);
}

export function categoryPdfTitle(title: string) {
  return /^(?:Muslim|Christian) Wedding Cards?$/i.test(title.trim())
    ? "Wedding Cards"
    : title;
}

export function pdfCategories(items: AdminLibraryItem[]): PdfCategory[] {
  return [
    ...CARD_TYPES.map((type) => ({
      value: `collection:${type.value}`,
      label: `${type.label}s`,
      category: type.itemCategory,
      publishedOnly: true,
    })),
    ...[...new Set(items.map((item) => item.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({
        value: `category:${category}`,
        label: category,
        category,
        publishedOnly: false,
      })),
  ];
}

export function itemsForPdf(items: AdminLibraryItem[], category: PdfCategory) {
  return items
    .filter(
      (item) =>
        item.category === category.category &&
        (!category.publishedOnly || (item.active && item.visible)),
    )
    .sort(
      (a, b) =>
        a.designNo.localeCompare(b.designNo, "en", { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
}

export function categoryPdfFilename(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return `${slug || "category"}-catalogue.pdf`;
}
