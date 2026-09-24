import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import { categoryPdfTitle, photosForPdf, type CategoryPdfData } from "./item-pdf-selection";
import { canvasBlob, loadPdfPhoto, type PdfPhotoLoader } from "./pdf-photo";
import { createPdfPhotoPool } from "./pdf-photo-pool";
export { loadPdfPhoto } from "./pdf-photo";

const ink = rgb(0.18, 0.25, 0.22);
const muted = rgb(0.45, 0.47, 0.45);
const paper = rgb(0.97, 0.97, 0.95);
function wrapText(
  text: string,
  width: number,
  measure: (text: string) => number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (line && measure(`${line} ${word}`) > width) {
      lines.push(line);
      line = "";
    }
    if (measure(word) > width) {
      for (const char of word) {
        if (line && measure(line + char) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export async function createCategoryPdf(
  data: CategoryPdfData,
  options: {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
    loadPhoto?: PdfPhotoLoader;
  } = {},
) {
  if (!data.items.length)
    throw new Error("There are no items in this category to export.");
  const { signal, onProgress, loadPhoto = loadPdfPhoto } = options;
  const checkCancelled = () => {
    if (signal?.aborted) throw new Error("PDF download cancelled.");
  };
  checkCancelled();
  const pdf = await PDFDocument.create();
  const title = categoryPdfTitle(data.title);
  pdf.setTitle(`${title} - Beyond Invitation`);
  pdf.setAuthor("Beyond Invitation");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const missingPhotos: string[] = [];
  const noPhotoItems: string[] = [];
  let lastProgress = -Infinity;
  const reportProgress = (message: string, force = false) => {
    const now = Date.now();
    if (force || now - lastProgress >= 400) {
      lastProgress = now;
      onProgress?.(message);
    }
  };
  type TextLayout = {
    font: PDFFont;
    size: number;
    height: number;
    lines: string[];
    image?: PDFImage;
  };
  const layouts = new Map<string, Promise<TextLayout>>();

  async function layoutText(
    text: string,
    size: number,
    heavy = false,
  ): Promise<TextLayout> {
    const font = heavy ? bold : regular;
    let canvas: HTMLCanvasElement | undefined;
    let context: CanvasRenderingContext2D | null = null;
    // Keep normal names selectable; use the browser's font fallback for other scripts.
    try {
      font.encodeText(text);
    } catch {
      canvas = document.createElement("canvas");
      context = canvas.getContext("2d");
      if (!context)
        throw new Error("Cannot render this card name in your browser.");
    }
    const measure = (value: string) => {
      if (!context) return font.widthOfTextAtSize(value, size);
      context.font = `${heavy ? "bold " : ""}${size}px Arial, sans-serif`;
      return context.measureText(value).width;
    };
    let lines = wrapText(text, 515, measure);
    while (lines.length * size * 1.35 > 110 && size > 6) {
      size -= 1;
      lines = wrapText(text, 515, measure);
    }
    const height = Math.max(size * 1.35, lines.length * size * 1.35);
    if (canvas && context) {
      canvas.width = 1030;
      canvas.height = Math.ceil(height * 2);
      context.scale(2, 2);
      context.font = `${heavy ? "bold " : ""}${size}px Arial, sans-serif`;
      context.fillStyle = "#2e4038";
      context.textBaseline = "top";
      lines.forEach((line, index) =>
        context!.fillText(line, 0, index * size * 1.35),
      );
      try {
        const image = await pdf.embedPng(await (await canvasBlob(canvas)).arrayBuffer());
        return { font, size, height, lines, image };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    return { font, size, height, lines };
  }

  async function textBlock(page: PDFPage, text: string, top: number, size: number, heavy = false) {
    const key = JSON.stringify([text, size, heavy]);
    let pending = layouts.get(key);
    if (!pending) {
      pending = layoutText(text, size, heavy);
      layouts.set(key, pending);
    }
    const layout = await pending;
    if (layout.image) {
      page.drawImage(layout.image, { x: 40, y: top - layout.height, width: 515, height: layout.height });
    } else {
      layout.lines.forEach((line, index) =>
        page.drawText(line, {
          x: 40,
          y: top - layout.size - index * layout.size * 1.35,
          size: layout.size,
          font: layout.font,
          color: ink,
        }),
      );
    }
    return layout.height;
  }

  const photosByItem = data.items.map((item) => photosForPdf(item.images));
  // Cache PDFImage objects rather than retaining an extra copy of every photo's bytes.
  const photoPool = createPdfPhotoPool(async (url, photoSignal) => {
    const bytes = await loadPhoto(url, photoSignal);
    if (photoSignal.aborted) throw new Error("PDF download cancelled.");
    return pdf.embedJpg(bytes);
  }, signal);
  let prefetched = 0;
  try {
    for (const [index, item] of data.items.entries()) {
      checkCancelled();
      // Keep the current item plus six upcoming items in the shared download queue.
      while (prefetched < Math.min(data.items.length, index + 7)) {
        photosByItem[prefetched++].forEach((url) => { void photoPool.get(url); });
      }
      const photos = photosByItem[index];
      if (!photos.length) noPhotoItems.push(item.designNo);
      reportProgress(
        `Preparing card ${index + 1} of ${data.items.length}...`,
      );
      const page = pdf.addPage([595.28, 841.89]);
      page.drawText("BEYOND INVITATION", {
        x: 40,
        y: 800,
        size: 10,
        font: bold,
        color: ink,
      });
      const categoryHeight = await textBlock(page, title, 782, 16);
      const rule = 770 - categoryHeight;
      page.drawLine({
        start: { x: 40, y: rule },
        end: { x: 555, y: rule },
        thickness: 0.6,
        color: muted,
      });
      const nameHeight = await textBlock(
        page,
        item.name || item.designNo,
        rule - 18,
        21,
        true,
      );
      const designTop = rule - 26 - nameHeight;
      const designHeight = await textBlock(
        page,
        `Design ${item.designNo}`,
        designTop,
        10,
      );
      const imageTop = designTop - designHeight - 20;
      const urls = photos;
      const results = await Promise.all(urls.map((url) => photoPool.get(url)));
      checkCancelled();
      const slots = Math.max(1, urls.length);
      const columns = slots === 1 ? 1 : 2;
      const rows = Math.ceil(slots / columns);
      const width = (515 - (columns - 1) * 16) / columns;
      const height = (imageTop - 65 - (rows - 1) * 16) / rows;
      for (let slot = 0; slot < slots; slot++) {
        const x = 40 + (slot % columns) * (width + 16);
        const y =
          imageTop -
          (Math.floor(slot / columns) + 1) * height -
          Math.floor(slot / columns) * 16;
        page.drawRectangle({ x, y, width, height, color: paper });
        const photo = results[slot];
        if (photo) {
          const scaled = photo.scaleToFit(width - 16, height - 32);
          page.drawImage(photo, {
            x: x + (width - scaled.width) / 2,
            y: y + 24 + (height - 32 - scaled.height) / 2,
            ...scaled,
          });
        }
        if (!photo) {
          if (urls[slot])
            missingPhotos.push(
              `${item.designNo}: photo ${slot + 1}`,
            );
          page.drawText(urls.length ? "Photo unavailable" : "No photo added", {
            x: x + 16,
            y: y + height / 2,
            size: 12,
            font: regular,
            color: muted,
          });
        }
        if (urls.length)
          page.drawText(`PHOTO ${slot + 1} OF ${photos.length}`, {
            x: x + 12,
            y: y + 10,
            size: 8,
            font: regular,
            color: muted,
          });
      }
      // Avoid forcing a React flush for every page, but keep cancellation responsive.
      if ((index + 1) % 10 === 0)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    checkCancelled();
    const pages = pdf.getPages();
    pages.forEach((page, index) => {
      page.drawText(`${data.items.length} designs`, {
        x: 40,
        y: 33,
        size: 9,
        font: regular,
        color: muted,
      });
      page.drawText(`${index + 1} / ${pages.length}`, {
        x: 510,
        y: 33,
        size: 9,
        font: regular,
        color: muted,
      });
    });
    reportProgress("Saving PDF...", true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    checkCancelled();
    const bytes = await pdf.save({ useObjectStreams: false });
    checkCancelled();
    return { bytes, missingPhotos, noPhotoItems };
  } finally {
    photoPool.dispose();
  }
}
