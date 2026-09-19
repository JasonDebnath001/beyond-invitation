"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  FileSpreadsheet,
  LayoutGrid,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ITEM_FIELDS,
  MAX_IMPORT_BYTES,
  type AdminData,
  type AdminItem,
  type ImportPlan,
  type ImportResult,
} from "@/lib/admin/item-fields";
import styles from "./ItemDashboard.module.css";

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
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"items" | "import">("items");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [working, setWorking] = useState<"preview" | "commit" | null>(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [previewPage, setPreviewPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);

  const loadItems = useCallback(async (companyId?: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/items${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load items.");
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
      requestId.current++;
    };
  }, [loadItems]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  const items = data?.items ?? [];
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
                disabled={loading || !!working}
                onChange={(event) => {
                  setPreview(null);
                  setResult(null);
                  setSelected(null);
                  void loadItems(event.target.value);
                }}
              >
                {!data && <option value="">Loading…</option>}
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
                  ? "Browse item details and keep your catalogue current with a spreadsheet."
                  : "Upload your file, review the changes, then import when you’re ready."}
              </p>
            </div>
            {tab === "items" && (
              <button
                className={styles.primary}
                onClick={() => setTab("import")}
              >
                <UploadCloud size={17} />
                Import items
              </button>
            )}
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
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
                    "With a description",
                    items.filter((item) => item.description).length,
                    "Web or item description",
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
                      disabled={!data || loading}
                      onClick={() =>
                        downloadCsv("items-export.csv", [
                          ITEM_FIELDS.map((field) => field.label),
                          ...items.map((item) =>
                            ITEM_FIELDS.map(
                              (field) => item.fields[field.label],
                            ),
                          ),
                        ])
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Export CSV
                    </button>
                    <button
                      className={styles.iconButton}
                      aria-label="Refresh items"
                      disabled={loading}
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
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>DESIGN / ITEM CODE</th>
                        <th>PRINT NAME</th>
                        <th>ITEM CATEGORY</th>
                        <th>SUBJECT</th>
                        <th>WEBSITE</th>
                        <th>
                          <span className={styles.srOnly}>Details</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6}>
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
                                className={styles.design}
                                onClick={() => setSelected(item)}
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
                                className={styles.iconButton}
                                aria-label={`View ${item.designNo} details`}
                                onClick={() => setSelected(item)}
                              >
                                <ArrowRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6}>
                            <div className={styles.empty}>
                              <Package size={30} />
                              <h3>
                                {query || filter !== "all"
                                  ? "No matching items"
                                  : "Your item library is empty"}
                              </h3>
                              <p>
                                {query || filter !== "all"
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

      {selected && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          onClose={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              dialog.current?.close();
            }
          }}
          aria-labelledby="item-detail-title"
        >
          <div className={styles.dialogBody}>
            <div className={styles.panelHeading}>
              <div>
                <div className={styles.eyebrow}>
                  ITEM DETAILS · {selected.code}
                </div>
                <h2 id="item-detail-title">{selected.designNo}</h2>
                <p>{selected.printName || "Print name not set"}</p>
              </div>
              <button
                autoFocus
                className={styles.iconButton}
                aria-label="Close item details"
                onClick={() => dialog.current?.close()}
              >
                <X size={21} />
              </button>
            </div>
            <dl className={styles.detailFields}>
              {Object.entries(selected.fields).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{display(value)}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.detailFooter}>
              Update this item by uploading a row with Item Name{" "}
              <strong>{selected.designNo}</strong>.
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
