"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  FileSpreadsheet,
  LayoutGrid,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ITEM_FIELDS,
  MAX_IMPORT_BYTES,
  type AdminData,
  type AdminLibraryData,
  type AdminItem,
  type ImportPlan,
  type ImportResult,
} from "@/lib/admin/item-fields";
import styles from "./ItemDashboard.module.css";
import ProductEditorDialog from "./ProductEditorDialog";
import ProductPhoto from "./ProductPhoto";
import { readAdminJson } from "@/lib/admin/item-client";
import {
  categoryPdfFilename,
  itemsForPdf,
  pdfCategories,
  type CategoryPdfData,
} from "@/lib/admin/item-pdf-selection";

type Preview = { plan: ImportPlan; token: string; columns: string[] };
const display = (value: unknown): string =>
  value == null || value === ""
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
const badgeClass = (status: string) =>
  `${styles.badge} ${styles[status] ?? ""}`;
function csvCell(value: unknown) {
  let text =
    value == null
      ? ""
      : typeof value === "boolean"
        ? value
          ? "Y"
          : "N"
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ItemDashboard() {
  const [data, setData] = useState<AdminLibraryData | null>(null);
  const [editorData, setEditorData] = useState<AdminData | null>(null);
  const [detailWorking, setDetailWorking] = useState<
    "editor" | "export" | "pdf" | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"items" | "import">("items");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState("");
  const [pdfCategory, setPdfCategory] = useState("");
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfOnlyWithPhotos, setPdfOnlyWithPhotos] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [working, setWorking] = useState<"preview" | "commit" | null>(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [previewPage, setPreviewPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const activeLoad = useRef<AbortController | null>(null);
  const activeDetail = useRef<AbortController | null>(null);

  const loadItems = useCallback(async (companyId?: string) => {
    const id = ++requestId.current;
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    setLoading(true);
    setError("");
    try {
      const body = await readAdminJson(
        `/api/admin/items${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`,
        controller.signal,
      );
      if (id === requestId.current) {
        setData(body);
        setPage(1);
      }
    } catch (error) {
      if (id === requestId.current) setError((error as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadItems();
    return () => {
      requestId.current += 1;
      activeLoad.current?.abort();
      activeDetail.current?.abort();
    };
  }, [loadItems]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const pdfOptions = useMemo(() => pdfCategories(items), [items]);
  const selectedPdfCategory = pdfOptions.find(
    (option) => option.value === pdfCategory,
  );
  const pdfItemCount = useMemo(
    () =>
      selectedPdfCategory ? itemsForPdf(items, selectedPdfCategory).length : 0,
    [items, selectedPdfCategory],
  );
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const term = query.trim().toLowerCase();
        return (
          (!term ||
            [
              item.designNo,
              item.printName,
              item.code,
              item.category,
              item.subject,
            ].some((value) => value.toLowerCase().includes(term))) &&
          (filter === "all" ||
            (filter === "website" && item.visible && item.active) ||
            (filter === "uncategorised" && !item.category) ||
            (filter === "missing-photo" && !item.imageUrl) ||
            (filter === "missing-description" && !item.hasDescription) ||
            (filter === "missing-title" && !item.printName) ||
            (filter === "disabled" && !item.active))
        );
      }),
    [items, query, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const visibleRows = filtered.slice((page - 1) * 50, page * 50);
  const previewRows =
    preview?.plan.rows.filter(
      (row) => previewFilter === "all" || row.status === previewFilter,
    ) ?? [];
  const readyCount =
    (preview?.plan.counts.create ?? 0) + (preview?.plan.counts.update ?? 0);

  async function openEditor(itemId?: string) {
    if (!data || detailWorking) return;
    const controller = new AbortController();
    activeDetail.current?.abort();
    activeDetail.current = controller;
    setDetailWorking("editor");
    setError("");
    setSuccess("");
    try {
      const body: AdminData = await readAdminJson(
        `/api/admin/items?view=editor&companyId=${encodeURIComponent(data.companyId)}${itemId ? `&itemId=${encodeURIComponent(itemId)}` : ""}`,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const selectedItem = itemId
        ? body.items.find((item) => item.id === itemId)
        : undefined;
      if (itemId && !selectedItem)
        throw new Error(
          "This item is no longer available. Refresh the library.",
        );
      setEditorData(body);
      setSelected(selectedItem ?? null);
      setAdding(!itemId);
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (activeDetail.current === controller) setDetailWorking(null);
    }
  }

  async function exportItems() {
    if (!data || detailWorking) return;
    const controller = new AbortController();
    activeDetail.current = controller;
    setDetailWorking("export");
    setError("");
    try {
      const body = await readAdminJson(
        `/api/admin/items?view=export&companyId=${encodeURIComponent(data.companyId)}`,
        controller.signal,
      );
      if (!controller.signal.aborted)
        downloadCsv("items-export.csv", body.rows);
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (activeDetail.current === controller) setDetailWorking(null);
    }
  }

  async function exportCategoryPdf() {
    if (!data || detailWorking || !selectedPdfCategory || !pdfItemCount) return;
    const controller = new AbortController();
    activeDetail.current = controller;
    setDetailWorking("pdf");
    setPdfProgress("Loading category photos...");
    setError("");
    setSuccess("");
    try {
      const body: CategoryPdfData = await readAdminJson(
        `/api/admin/items?view=pdf&companyId=${encodeURIComponent(data.companyId)}&category=${encodeURIComponent(pdfCategory)}&onlyWithPhotos=${pdfOnlyWithPhotos}`,
        controller.signal,
      );
      const { createCategoryPdf } = await import("@/lib/admin/category-pdf");
      const { bytes, missingPhotos, noPhotoItems } = await createCategoryPdf(
        body,
        {
          signal: controller.signal,
          onProgress: setPdfProgress,
        },
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = categoryPdfFilename(body.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      const warnings = [
        missingPhotos.length
          ? `${missingPhotos.length} photo(s) could not be loaded`
          : "",
        noPhotoItems.length
          ? `${noPhotoItems.length} card(s) have no photos`
          : "",
      ].filter(Boolean);
      setSuccess(
        `${body.title} PDF downloaded with ${body.items.length} card(s).${body.skippedItemCount ? ` ${body.skippedItemCount} card(s) without photos skipped.` : ""}${warnings.length ? ` Note: ${warnings.join("; ")}. These are marked in the PDF.` : ""}`,
      );
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (activeDetail.current === controller) {
        setDetailWorking(null);
        setPdfProgress("");
      }
    }
  }

  function chooseFile(next: File | null) {
    setPreview(null);
    setResult(null);
    setError("");
    setPreviewFilter("all");
    setPreviewPage(1);
    if (
      next &&
      (!/\.(csv|xlsx)$/i.test(next.name) || next.size > MAX_IMPORT_BYTES)
    ) {
      setFile(null);
      setError("Choose a CSV or XLSX file up to 4 MB.");
      return;
    }
    setFile(next);
  }
  async function upload(action: "preview" | "commit") {
    if (!file || !data || working) return;
    setWorking(action);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("companyId", data.companyId);
    form.set("action", action);
    form.set("createMissing", String(createMissing));
    if (preview) form.set("token", preview.token);
    try {
      const response = await fetch("/api/admin/items/import", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) setPreview(null);
        throw new Error(body.error || "Import request failed.");
      }
      if (action === "preview") {
        setPreview(body);
        setResult(null);
        setPreviewPage(1);
      } else {
        setResult(body.result);
        setPreview(null);
        await loadItems(data.companyId);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <a href="/admin" className={styles.brand}>
          <Image
            src="/logo.png"
            alt=""
            width={44}
            height={44}
            priority
            className={styles.brandMark}
          />
          <span>
            Beyond Invitation<small>CATALOGUE ADMIN</small>
          </span>
        </a>
        <div className={styles.sidebarLabel}>WORKSPACE</div>
        <button
          className={tab === "items" ? styles.navActive : styles.navButton}
          onClick={() => setTab("items")}
        >
          <LayoutGrid size={18} />
          All items<span>{items.length || "—"}</span>
        </button>
        <button
          className={tab === "import" ? styles.navActive : styles.navButton}
          onClick={() => setTab("import")}
        >
          <UploadCloud size={18} />
          Import items
        </button>
        {/* Full navigation matches the item workspace's existing navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/admin/blogs" className={styles.navButton}>
          <BookOpen size={18} />
          Blogs
        </a>
        <div className={styles.sidebarNote}>
          <span className={styles.statusDot} />
          Connected catalogue
          <p>Item names, categories and website details in one place.</p>
        </div>
        <div className={styles.adminLabel}>
          ADMIN WORKSPACE <span>/admin</span>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <span>
            Workspace <span className={styles.slash}>/</span>{" "}
            <strong>{tab === "items" ? "Items" : "Import"}</strong>
          </span>
          <div className={styles.topbarRight}>
            <label className={styles.companyLabel}>
              Company
              <select
                aria-label="Company"
                value={data?.companyId ?? ""}
                disabled={
                  loading ||
                  !!working ||
                  !!detailWorking ||
                  adding ||
                  !!selected
                }
                onChange={(event) => {
                  setPreview(null);
                  setResult(null);
                  setSelected(null);
                  setSuccess("");
                  setPdfCategory("");
                  void loadItems(event.target.value);
                }}
              >
                {!data && (
                  <option value="">
                    {loading ? "Loading…" : "Unavailable"}
                  </option>
                )}
                {data?.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <Image
              src="/logo.png"
              alt="Beyond Invitation logo"
              width={37}
              height={37}
              className={styles.avatar}
            />
          </div>
        </header>

        <main className={styles.content}>
          <div className={styles.heading}>
            <div>
              <div className={styles.eyebrow}>YOUR PRODUCT CATALOGUE</div>
              <h1>
                {tab === "items"
                  ? "Every item. One place."
                  : "Bring your items up to date."}
              </h1>
              <p>
                {tab === "items"
                  ? "Add missing photos and details. Open any item to edit and save it."
                  : "Upload your file, review the changes, then import when you’re ready."}
              </p>
            </div>
            {tab === "items" && (
              <div className={styles.headingActions}>
                <button
                  className={styles.textButton}
                  onClick={() => setTab("import")}
                >
                  <UploadCloud size={17} />
                  Import items
                </button>
                <button
                  className={styles.primary}
                  disabled={
                    !data || loading || !!working || !!detailWorking || !!error
                  }
                  onClick={() => void openEditor()}
                >
                  <Plus size={17} /> Add product
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              {tab === "items" && (
                <button
                  className={styles.textButton}
                  disabled={loading || !!detailWorking}
                  onClick={() => void loadItems(data?.companyId)}
                >
                  Retry
                </button>
              )}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {detailWorking && (
            <div className={styles.success} role="status">
              <LoaderCircle size={18} className={styles.spin} />
              <span>
                {detailWorking === "pdf"
                  ? pdfProgress
                  : detailWorking === "editor"
                    ? "Loading item details…"
                    : "Preparing CSV export…"}
              </span>
              {detailWorking === "pdf" && (
                <button
                  className={styles.textButton}
                  onClick={() => activeDetail.current?.abort()}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {success && (
            <div className={styles.success} role="status">
              <Check size={18} />
              <span>{success}</span>
              <button
                className={styles.iconButton}
                aria-label="Dismiss success"
                onClick={() => setSuccess("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {tab === "items" ? (
            <>
              <section className={styles.stats} aria-label="Catalogue totals">
                {[
                  ["Total items", items.length, "In this company"],
                  [
                    "On the website",
                    items.filter((item) => item.visible && item.active).length,
                    "Active & visible",
                  ],
                  [
                    "Missing category",
                    items.filter((item) => !item.category).length,
                    "Needs a category",
                  ],
                  [
                    "Missing main photo",
                    items.filter((item) => !item.imageUrl).length,
                    "Ready for a photo",
                  ],
                ].map(([label, count, hint], i) => (
                  <div className={styles.stat} key={label}>
                    <span>{label}</span>
                    <strong
                      className={
                        i === 2 && Number(count) > 0 ? styles.amber : ""
                      }
                    >
                      {loading ? "—" : Number(count).toLocaleString("en-IN")}
                    </strong>
                    <small>{hint}</small>
                  </div>
                ))}
              </section>

              <section
                className={styles.panel}
                aria-label="Category PDF download"
              >
                <div className={styles.panelHeading}>
                  <div>
                    <h2>Download a category catalogue</h2>
                    <p>
                      Card names, design numbers and up to four photos per card
                      in one PDF.
                    </p>
                  </div>
                </div>
                <div className={styles.pdfToolbar}>
                  <label className={styles.pdfCategory}>
                    Category
                    <select
                      value={pdfCategory}
                      disabled={!data || loading || !!detailWorking}
                      onChange={(event) => setPdfCategory(event.target.value)}
                    >
                      <option value="">Choose a category</option>
                      <optgroup label="Website collections">
                        {pdfOptions
                          .filter((option) => option.publishedOnly)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Item categories (all items)">
                        {pdfOptions
                          .filter((option) => !option.publishedOnly)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </label>
                  <label className={styles.pdfPhotoToggle}>
                    <input
                      type="checkbox"
                      checked={pdfOnlyWithPhotos}
                      disabled={!data || loading || !!detailWorking}
                      onChange={(event) =>
                        setPdfOnlyWithPhotos(event.target.checked)
                      }
                    />
                    Only cards with photos
                  </label>
                  <button
                    className={styles.primary}
                    disabled={
                      !data || loading || !!detailWorking || !pdfItemCount
                    }
                    onClick={() => void exportCategoryPdf()}
                  >
                    {detailWorking === "pdf" ? (
                      <LoaderCircle size={17} className={styles.spin} />
                    ) : (
                      <ArrowDownToLine size={17} />
                    )}
                    {detailWorking === "pdf"
                      ? "Preparing PDF..."
                      : "Download PDF"}
                  </button>
                </div>
                <p className={styles.pdfHint}>
                  {selectedPdfCategory
                    ? `${pdfItemCount} card(s) in this category. ${selectedPdfCategory.publishedOnly ? "Includes active cards shown on the website." : "Includes hidden and disabled items."} ${pdfOnlyWithPhotos ? "Cards without photos are skipped." : "Includes cards without photos."} Exports across all library pages.`
                    : "Choose a website collection or an item category to download."}
                </p>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>
                      Item library{" "}
                      <span className={styles.count}>{items.length}</span>
                    </h2>
                    <p>
                      Item Name is the design number. Print Name is the
                      storefront title.
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.textButton}
                      disabled={!data || loading || !!detailWorking}
                      onClick={() => void exportItems()}
                    >
                      <ArrowDownToLine size={16} />
                      Export CSV
                    </button>
                    <button
                      className={styles.iconButton}
                      aria-label="Refresh items"
                      disabled={loading || !!detailWorking}
                      onClick={() => void loadItems(data?.companyId)}
                    >
                      <RefreshCw
                        size={17}
                        className={loading ? styles.spin : ""}
                      />
                    </button>
                  </div>
                </div>
                <div className={styles.toolbar}>
                  <label className={styles.search}>
                    <Search size={17} />
                    <input
                      aria-label="Search items"
                      placeholder="Search design number, name or category…"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <select
                    aria-label="Filter items"
                    className={styles.filter}
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All items</option>
                    <option value="website">On the website</option>
                    <option value="uncategorised">Missing category</option>
                    <option value="missing-photo">Missing main photo</option>
                    <option value="missing-description">
                      Missing description
                    </option>
                    <option value="missing-title">Missing print name</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>PHOTO</th>
                        <th>DESIGN / ITEM CODE</th>
                        <th>PRINT NAME</th>
                        <th>ITEM CATEGORY</th>
                        <th>SUBJECT</th>
                        <th>WEBSITE</th>
                        <th>
                          <span className={styles.srOnly}>Edit item</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7}>
                            <div className={styles.empty}>
                              <LoaderCircle className={styles.spin} size={24} />
                              <p>Loading your item library…</p>
                            </div>
                          </td>
                        </tr>
                      ) : visibleRows.length ? (
                        visibleRows.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <button
                                className={styles.itemPhoto}
                                disabled={!!detailWorking}
                                aria-label={`Edit ${item.designNo} photo`}
                                onClick={() => void openEditor(item.id)}
                              >
                                <ProductPhoto
                                  src={item.imageUrl}
                                  alt={`${item.designNo} main photo`}
                                />
                              </button>
                            </td>
                            <td>
                              <button
                                className={styles.design}
                                disabled={!!detailWorking}
                                onClick={() => void openEditor(item.id)}
                              >
                                {item.designNo}
                              </button>
                              <small className={styles.code}>{item.code}</small>
                            </td>
                            <td className={styles.nameCell}>
                              {item.printName || (
                                <span className={styles.muted}>
                                  Uses design number
                                </span>
                              )}
                            </td>
                            <td>
                              {item.category || (
                                <span className={badgeClass("invalid")}>
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className={styles.subject}>
                              {item.subject || "—"}
                            </td>
                            <td>
                              <span
                                className={badgeClass(
                                  !item.active
                                    ? "invalid"
                                    : item.visible
                                      ? "update"
                                      : "unchanged",
                                )}
                              >
                                {!item.active
                                  ? "Disabled"
                                  : item.visible
                                    ? "Visible"
                                    : "Hidden"}
                              </span>
                            </td>
                            <td>
                              <button
                                className={styles.textButton}
                                aria-label={`Edit ${item.designNo}`}
                                disabled={!!detailWorking}
                                onClick={() => void openEditor(item.id)}
                              >
                                <Pencil size={16} /> Edit
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>
                            <div className={styles.empty}>
                              <Package size={30} />
                              <h3>
                                {!data
                                  ? "Could not load the item library"
                                  : query || filter !== "all"
                                    ? "No matching items"
                                    : "Your item library is empty"}
                              </h3>
                              <p>
                                {!data
                                  ? "Retry or refresh to load your items."
                                  : query || filter !== "all"
                                    ? "Try a different search or filter."
                                    : "Import a spreadsheet to add your first items."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.pagination}>
                  <span>
                    {filtered.length
                      ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, filtered.length)} of ${filtered.length} items`
                      : "0 items"}
                  </span>
                  <div>
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className={styles.steps}>
                <span className={styles.stepActive}>
                  <b>1</b>Upload file
                </span>
                <span className={preview || result ? styles.stepActive : ""}>
                  <b>2</b>Review changes
                </span>
                <span className={result ? styles.stepActive : ""}>
                  <b>3</b>Import results
                </span>
              </div>
              <div className={styles.importGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <h2>Upload item details</h2>
                      <p>CSV or Excel · up to 1,000 rows · 4 MB maximum</p>
                    </div>
                    <FileSpreadsheet size={22} className={styles.muted} />
                  </div>
                  <div className={styles.uploadBody}>
                    <input
                      className={styles.srOnly}
                      id="item-file"
                      type="file"
                      accept=".csv,.xlsx"
                      ref={fileInput}
                      disabled={!!working}
                      onChange={(event) =>
                        chooseFile(event.target.files?.[0] ?? null)
                      }
                    />
                    <button
                      type="button"
                      disabled={!!working}
                      className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
                      onClick={() => fileInput.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!working) setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        if (!working)
                          chooseFile(event.dataTransfer.files[0] ?? null);
                      }}
                    >
                      <span className={styles.uploadIcon}>
                        {file ? (
                          <FileSpreadsheet size={26} />
                        ) : (
                          <UploadCloud size={26} />
                        )}
                      </span>
                      <strong>
                        {file ? file.name : "Drop your spreadsheet here"}
                      </strong>
                      <span>
                        {file
                          ? `${(file.size / 1024).toFixed(1)} KB · Click to choose another file`
                          : "or click to browse files"}
                      </span>
                      <small>
                        Accepts your Item_Template.xlsx or a CSV export
                      </small>
                    </button>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={createMissing}
                        disabled={!!working}
                        onChange={(event) => {
                          setCreateMissing(event.target.checked);
                          setPreview(null);
                          setResult(null);
                        }}
                      />
                      <span>
                        Create missing categories and reference records
                        <small>
                          Categories, groups, brands, subjects, seasons, KE /
                          Bharat names and sample categories. Each creation
                          appears in the preview.
                        </small>
                      </span>
                    </label>
                    <div className={styles.uploadActions}>
                      <button
                        className={styles.textButton}
                        onClick={() =>
                          downloadCsv("item-template.csv", [
                            ITEM_FIELDS.map((field) => field.label),
                          ])
                        }
                      >
                        <ArrowDownToLine size={16} />
                        CSV template
                      </button>
                      <button
                        className={styles.primary}
                        disabled={!file || !data || loading || !!working}
                        onClick={() => void upload("preview")}
                      >
                        {working === "preview" ? (
                          <LoaderCircle size={17} className={styles.spin} />
                        ) : (
                          <Search size={17} />
                        )}
                        {working === "preview"
                          ? "Checking your file…"
                          : "Preview changes"}
                      </button>
                    </div>
                  </div>
                </section>
                <aside className={styles.guide}>
                  <span className={styles.eyebrow}>HOW IMPORTS WORK</span>
                  <h2>
                    A clear update,
                    <br />
                    every time.
                  </h2>
                  <ul>
                    <li>
                      <Check size={16} />
                      <span>
                        <strong>Match by design number</strong>Item Name finds
                        the existing item. IDs and codes are checked for
                        conflicts.
                      </span>
                    </li>
                    <li>
                      <Check size={16} />
                      <span>
                        <strong>Update what changed</strong>Existing details are
                        compared field by field. Identical rows are left alone.
                      </span>
                    </li>
                    <li>
                      <Check size={16} />
                      <span>
                        <strong>Keep your existing details</strong>Blank cells
                        preserve current values. Use <code>[clear]</code> to
                        clear an optional field.
                      </span>
                    </li>
                    <li>
                      <Check size={16} />
                      <span>
                        <strong>Create new items</strong>New designs need Item
                        Group and Item Type. A blank code gets a unique WEB
                        code.
                      </span>
                    </li>
                  </ul>
                  <p>
                    Item Category and Subject are separate fields. Website Price
                    List selects an existing selling list; this template does
                    not contain selling prices.
                  </p>
                </aside>
              </div>

              {preview && (
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <h2>Review your import</h2>
                      <p>
                        {preview.plan.rows.length} rows checked ·{" "}
                        {preview.columns.length} recognised columns
                      </p>
                    </div>
                    <button
                      className={styles.primary}
                      disabled={!readyCount || !!working || loading}
                      onClick={() => void upload("commit")}
                    >
                      {working === "commit" ? (
                        <LoaderCircle size={17} className={styles.spin} />
                      ) : (
                        <Check size={17} />
                      )}
                      {working === "commit"
                        ? "Saving items…"
                        : `Import ${readyCount} ready ${readyCount === 1 ? "row" : "rows"}`}
                    </button>
                  </div>
                  <div className={styles.previewCounts}>
                    {(
                      ["create", "update", "unchanged", "invalid"] as const
                    ).map((status) => (
                      <button
                        key={status}
                        className={
                          previewFilter === status ? styles.selectedFilter : ""
                        }
                        onClick={() => {
                          setPreviewFilter(
                            previewFilter === status ? "all" : status,
                          );
                          setPreviewPage(1);
                        }}
                      >
                        <span className={badgeClass(status)}>
                          {status === "create"
                            ? "New"
                            : status === "update"
                              ? "Changed"
                              : status === "invalid"
                                ? "Needs attention"
                                : "Unchanged"}
                        </span>
                        <strong>{preview.plan.counts[status]}</strong>
                      </button>
                    ))}
                  </div>
                  {preview.plan.counts.invalid > 0 && (
                    <p className={styles.notice}>
                      {preview.plan.counts.invalid} invalid{" "}
                      {preview.plan.counts.invalid === 1
                        ? "row will"
                        : "rows will"}{" "}
                      be skipped. Correct those rows in your file and upload
                      them again.
                    </p>
                  )}
                  {preview.plan.lookups.length > 0 && (
                    <div className={styles.referenceNotice}>
                      <strong>New reference records</strong>
                      <p>
                        {preview.plan.lookups
                          .map(
                            (ref) =>
                              `${ref.name} (${ref.table.replace(/_/g, " ")})`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                  {preview.plan.warnings.length > 0 && (
                    <details className={styles.warnings}>
                      <summary>
                        File notes ({preview.plan.warnings.length})
                      </summary>
                      {preview.plan.warnings.map((warning, i) => (
                        <p key={i}>{warning}</p>
                      ))}
                    </details>
                  )}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ROW</th>
                          <th>DESIGN NUMBER</th>
                          <th>RESULT</th>
                          <th>CHANGES / ISSUES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows
                          .slice((previewPage - 1) * 50, previewPage * 50)
                          .map((row) => (
                            <tr key={row.row}>
                              <td>{row.row}</td>
                              <td>
                                <strong>
                                  {row.designNo || "Missing name"}
                                </strong>
                              </td>
                              <td>
                                <span className={badgeClass(row.status)}>
                                  {row.status === "create"
                                    ? "New"
                                    : row.status === "update"
                                      ? "Update"
                                      : row.status === "invalid"
                                        ? "Skipped"
                                        : "Unchanged"}
                                </span>
                              </td>
                              <td>
                                {row.errors.length ? (
                                  <ul className={styles.rowErrors}>
                                    {row.errors.map((error, i) => (
                                      <li key={i}>{error}</li>
                                    ))}
                                  </ul>
                                ) : row.changes.length ? (
                                  <details className={styles.changes}>
                                    <summary>
                                      {row.changes.length} field{" "}
                                      {row.changes.length === 1
                                        ? "change"
                                        : "changes"}{" "}
                                      <span>View details</span>
                                    </summary>
                                    <dl>
                                      {row.changes.map((change) => (
                                        <div key={change.field}>
                                          <dt>{change.label}</dt>
                                          <dd>
                                            <del>{display(change.before)}</del>
                                            <ArrowRight size={13} />
                                            <span>{display(change.after)}</span>
                                          </dd>
                                        </div>
                                      ))}
                                    </dl>
                                  </details>
                                ) : (
                                  <span className={styles.muted}>
                                    Already up to date
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.pagination}>
                    <span>
                      {previewRows.length} rows
                      {previewFilter !== "all" ? " in this filter" : ""}
                    </span>
                    <div>
                      <button
                        disabled={previewPage === 1}
                        onClick={() => setPreviewPage(previewPage - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        {previewPage} /{" "}
                        {Math.max(1, Math.ceil(previewRows.length / 50))}
                      </span>
                      <button
                        disabled={previewPage * 50 >= previewRows.length}
                        onClick={() => setPreviewPage(previewPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {result && (
                <section
                  className={`${styles.panel} ${styles.result}`}
                  aria-live="polite"
                >
                  <div className={styles.panelHeading}>
                    <div>
                      <h2>
                        {result.failed
                          ? "Import finished with issues"
                          : "Import complete"}
                      </h2>
                      <p>
                        {result.created} created · {result.updated} updated ·{" "}
                        {result.unchanged} unchanged · {result.skipped} skipped
                        · {result.failed} failed
                      </p>
                    </div>
                    <button
                      className={styles.textButton}
                      onClick={() =>
                        downloadCsv("item-import-results.csv", [
                          ["Row", "Design number", "Result", "Message"],
                          ...result.rows.map((row) => [
                            row.row,
                            row.designNo,
                            row.status,
                            row.message,
                          ]),
                        ])
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Download results
                    </button>
                  </div>
                  {(result.failed > 0 || result.skipped > 0) && (
                    <div className={styles.resultIssues}>
                      {result.rows
                        .filter((row) =>
                          ["failed", "skipped"].includes(row.status),
                        )
                        .map((row) => (
                          <p key={row.row}>
                            <strong>
                              Row {row.row} · {row.designNo}:
                            </strong>{" "}
                            {row.message}
                          </p>
                        ))}
                      <p>
                        Successful rows are saved. Correct the issues, then
                        preview the file again; unchanged rows will be skipped
                        automatically.
                      </p>
                    </div>
                  )}
                  <div className={styles.resultFooter}>
                    <Check size={20} />
                    <span>Your item library has been refreshed.</span>
                    <button
                      className={styles.textButton}
                      onClick={() => setTab("items")}
                    >
                      View items <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className={styles.footer}>
            Beyond Invitation <span>Catalogue workspace</span>
          </footer>
        </main>
      </div>

      {adding && data && editorData && (
        <ProductEditorDialog
          data={editorData}
          onClose={(refresh) => {
            setAdding(false);
            if (refresh) void loadItems(data.companyId);
          }}
          onSaved={(product) => {
            setAdding(false);
            setSuccess(`Product ${product.designNo} added successfully.`);
            setQuery("");
            setFilter("all");
            setPreview(null);
            setResult(null);
            void loadItems(data.companyId);
          }}
        />
      )}

      {selected && data && editorData && (
        <ProductEditorDialog
          key={selected.id}
          data={editorData}
          item={selected}
          onClose={(refresh) => {
            setSelected(null);
            if (refresh) void loadItems(data.companyId);
          }}
          onSaved={(product) => {
            setSelected(null);
            setSuccess(`Changes to ${product.designNo} saved successfully.`);
            setPreview(null);
            setResult(null);
            void loadItems(data.companyId);
          }}
        />
      )}
    </div>
  );
}
