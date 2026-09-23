"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Plus,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ALL_ITEM_FIELDS,
  NEW_ITEM_DEFAULTS,
  MAX_PRODUCT_PHOTO_SOURCE_BYTES,
  MAX_PRODUCT_PHOTOS,
  type AdminData,
  type AdminItem,
  type ItemField,
} from "@/lib/admin/item-fields";
import styles from "./ItemDashboard.module.css";
import ProductPhoto from "./ProductPhoto";
import { prepareProductPhoto } from "@/lib/admin/item-photo-client";

type QueuedPhoto = {
  id: string;
  file: File;
  sourceName: string;
  sourceKey: string;
  saved: boolean;
  replaces?: string;
  attempted?: boolean;
  error?: string;
};
type SavedProduct = { id: string; designNo: string };
const photoKey = (file: File) =>
  JSON.stringify([file.name, file.size, file.lastModified]);

function PhotoPreview({
  photo,
  onRemove,
}: {
  photo: QueuedPhoto;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(photo.file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo.file]);
  return (
    <div className={styles.galleryPhoto}>
      <div className={styles.photoPreview}>
        <ProductPhoto src={url} alt={photo.sourceName} />
      </div>
      <span className={styles.photoName}>{photo.sourceName}</span>
      <small>
        {photo.saved
          ? photo.replaces
            ? "Photo replaced"
            : "Added to gallery"
          : photo.error
            ? "Retry required"
            : photo.replaces
              ? "Ready to replace photo"
              : "Ready to upload"}
      </small>
      {!photo.saved && !(photo.replaces && photo.attempted) && (
        <button
          type="button"
          className={styles.textButton}
          aria-label={`Remove ${photo.sourceName}`}
          onClick={onRemove}
        >
          {photo.replaces ? "Cancel replacement" : "Remove"}
        </button>
      )}
      {photo.error && (
        <small className={styles.photoError}>{photo.error}</small>
      )}
    </div>
  );
}

const basics = [
  "name",
  "print_name",
  "code",
  "item_type",
  "group_id",
  "item_category_id",
  "brand_id",
  "subject_id",
];
const website = [
  "web_description",
  "website_price_list_id",
  "min_order_qty",
  "order_multiple",
  "show_on_website",
  "is_active",
];
const otherFields = ALL_ITEM_FIELDS.filter(
  (field) =>
    field.key !== "id" &&
    !basics.includes(field.key) &&
    !website.includes(field.key) &&
    !["image_url", "thumb_url"].includes(field.key),
);
const hints: Record<string, string> = {
  name: "The unique design number, for example AC-590.",
  print_name: "The title customers see. Uses the design number when blank.",
  code: "Leave blank to generate an item code automatically.",
  item_type: "Choose a suggestion or enter an item type from your item master.",
  image_url: "Paste a publicly accessible image link.",
  website_price_list_id:
    "Selling prices are managed in the selected price list. Adding a product does not set its selling price.",
  show_on_website:
    "Choose Yes when the product is ready to appear in the storefront.",
};

export default function ProductEditorDialog({
  data,
  item,
  onClose,
  onSaved,
}: {
  data: AdminData;
  item?: AdminItem;
  onClose: (refresh?: boolean) => void;
  onSaved: (product: { id: string; designNo: string }) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState("");
  const preparation = useRef<AbortController | null>(null);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [savedProduct, setSavedProduct] = useState<SavedProduct | null>(null);
  const [progress, setProgress] = useState("");
  const [photoLink, setPhotoLink] = useState(item?.values.image_url ?? "");
  const photoInput = useRef<HTMLInputElement>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const replacementTarget = useRef<string | undefined>(undefined);
  const company = data.companies.find(
    (company) => company.id === data.companyId,
  );

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      preparation.current?.abort();
      element?.close();
    };
  }, []);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error, issues]);
  const existingPhotos = [
    ...new Set(
      [
        photoLink,
        ...(item?.images ?? []).filter((url) => url !== item?.values.image_url),
      ].filter(Boolean),
    ),
  ].filter(
    (url) => !photos.some((photo) => photo.saved && photo.replaces === url),
  );
  const replacingMainPhoto = photos.some(
    (photo) => photo.replaces && photo.replaces === item?.values.image_url,
  );

  async function choosePhotos(files: File[], replaces?: string) {
    if (!files.length || preparation.current || submitting.current) return;
    if (replaces && photos.some((photo) => photo.replaces === replaces)) return;
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          !file.size ||
          file.size > MAX_PRODUCT_PHOTO_SOURCE_BYTES,
      )
    ) {
      setError("Choose JPG, PNG or WebP photos up to 20 MB each.");
      return;
    }
    const seen = new Set(
      photos
        .filter((photo) => photo.replaces === replaces)
        .map((photo) => photo.sourceKey),
    );
    const additions = files.filter((file) => {
      const key = photoKey(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (photos.length + additions.length > MAX_PRODUCT_PHOTOS) {
      setError(`Choose up to ${MAX_PRODUCT_PHOTOS} photos at a time.`);
      return;
    }
    const controller = new AbortController();
    preparation.current = controller;
    setError("");
    setIssues([]);
    const failures: string[] = [];
    try {
      for (const [index, file] of additions.entries()) {
        setPreparing(`Preparing photo ${index + 1} of ${additions.length}…`);
        try {
          const prepared = await prepareProductPhoto(file, controller.signal);
          if (controller.signal.aborted) return;
          const photo = {
            id: crypto.randomUUID(),
            file: prepared,
            sourceName: file.name,
            sourceKey: photoKey(file),
            saved: false,
            replaces,
          };
          setPhotos((current) => [...current, photo]);
        } catch (error) {
          if (controller.signal.aborted) return;
          failures.push(
            `${file.name}: ${error instanceof Error ? error.message : "Could not prepare this photo."}`,
          );
        }
      }
      if (failures.length) {
        setError(
          "Some photos could not be prepared. Select them again to retry.",
        );
        setIssues(failures);
      }
    } finally {
      if (preparation.current === controller) preparation.current = null;
      if (!controller.signal.aborted) setPreparing("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || preparation.current) return;
    // Read before disabling the fieldset; disabled fields are excluded from FormData.
    const form = event.currentTarget;
    if (!savedProduct && !item && !form.reportValidity()) return;
    const values: Record<string, string> = {};
    for (const [key, value] of savedProduct
      ? []
      : new FormData(form).entries()) {
      if (
        typeof value !== "string" ||
        (item && (key === "name" || value === (item.values[key] ?? "")))
      )
        continue;
      if (item) {
        const control = form.elements.namedItem(key) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (!control.reportValidity()) return;
      }
      values[key] = value;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    setIssues([]);
    let product = savedProduct;
    try {
      if (!product) {
        const response = await fetch("/api/admin/items", {
          method: item ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: data.companyId,
            values,
            ...(item ? { id: item.id, expectedUpdatedAt: item.updatedAt } : {}),
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          setIssues(Array.isArray(body.issues) ? body.issues : []);
          throw new Error(
            body.error || "Could not save the product. Please try again.",
          );
        }
        product = body as SavedProduct;
        setSavedProduct(product);
      }
      const pending = photos.filter((photo) => !photo.saved);
      let failed = 0;
      for (const [index, photo] of pending.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${pending.length}…`);
        const upload = new FormData();
        upload.set("companyId", data.companyId);
        upload.set("itemId", product.id);
        upload.set("uploadId", photo.id);
        upload.set("photo", photo.file);
        if (photo.replaces) upload.set("replaceUrl", photo.replaces);
        setPhotos((current) =>
          current.map((entry) =>
            entry.id === photo.id ? { ...entry, attempted: true } : entry,
          ),
        );
        try {
          const response = await fetch("/api/admin/items/photos", {
            method: "POST",
            body: upload,
          });
          const body = await response.json();
          if (!response.ok)
            throw new Error(body.error || "Could not upload this photo.");
          setPhotos((current) =>
            current.map((entry) =>
              entry.id === photo.id
                ? { ...entry, saved: true, error: undefined }
                : entry,
            ),
          );
        } catch (error) {
          failed++;
          setPhotos((current) =>
            current.map((entry) =>
              entry.id === photo.id
                ? {
                    ...entry,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Could not upload this photo.",
                  }
                : entry,
            ),
          );
        }
      }
      if (failed) {
        setError(
          `Item details are saved. ${photos.length - failed} of ${photos.length} selected photos are saved. Retry the ${failed} remaining photo${failed === 1 ? "" : "s"} to finish uploading and deleting any replaced photos.`,
        );
        return;
      }
      onSaved(product);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save the product. Please try again.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
      setProgress("");
    }
  }

  function renderField(field: ItemField) {
    const required =
      field.key === "name" ||
      (field.requiredForNew && (!item || !!item.values[field.key]));
    const description = field.key.includes("description");
    const label =
      field.key === "name"
        ? "Design number / Item Name"
        : field.label.replace(/ \*$/, "");
    const id = `new-product-${field.key}`;
    const options = field.table
      ? (data.referenceOptions[field.table] ?? [])
      : [];
    const common = {
      id,
      name: field.key,
      required: !!required,
      defaultValue: item
        ? (item.values[field.key] ?? "")
        : (NEW_ITEM_DEFAULTS[field.key] ?? ""),
      "aria-describedby": hints[field.key] ? `${id}-hint` : undefined,
    };
    return (
      <div
        className={`${styles.formField} ${description ? styles.formWide : ""}`}
        key={field.key}
      >
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {field.table ? (
          <select {...common}>
            <option value="">
              {required ? "Select an option" : "Not set"}
            </option>
            {item?.values[field.key] &&
              !options.some(
                (option) => option.id === item.values[field.key],
              ) && (
                <option value={item.values[field.key]}>
                  {String(item.fields[field.label] || item.values[field.key])}{" "}
                  (current)
                </option>
              )}
            {options
              .filter(
                (option) =>
                  field.key !== "variant_of" || option.id !== item?.id,
              )
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.shared ? " (shared)" : ""}
                </option>
              ))}
          </select>
        ) : field.kind === "boolean" || field.kind === "disable" ? (
          <select {...common}>
            {(item
              ? !item.values[field.key]
              : !Object.hasOwn(NEW_ITEM_DEFAULTS, field.key)) && (
              <option value="">Use default</option>
            )}
            <option value="N">No</option>
            <option value="Y">Yes</option>
          </select>
        ) : description ? (
          <textarea {...common} rows={4} maxLength={30000} />
        ) : (
          <input
            {...common}
            autoFocus={field.key === (item ? "print_name" : "name")}
            readOnly={!!item && field.key === "name"}
            disabled={
              replacingMainPhoto &&
              ["image_url", "thumb_url"].includes(field.key)
            }
            onChange={
              field.key === "image_url"
                ? (event) => setPhotoLink(event.target.value)
                : undefined
            }
            type={
              field.kind === "date"
                ? "date"
                : ["number", "integer"].includes(field.kind)
                  ? "number"
                  : field.key.endsWith("_url")
                    ? "url"
                    : "text"
            }
            min={
              ["min_order_qty", "order_multiple"].includes(field.key) ? 1 : 0
            }
            max={field.key === "offer_pct" ? 100 : undefined}
            step={field.kind === "integer" ? 1 : "any"}
            maxLength={2000}
            list={field.key === "item_type" ? "new-product-types" : undefined}
          />
        )}
        {hints[field.key] && (
          <small id={`${id}-hint`}>{hints[field.key]}</small>
        )}
        {required && field.table && !options.length && (
          <small>
            No options available. Set up an {label.toLowerCase()} in the item
            master first.
          </small>
        )}
      </div>
    );
  }

  const fieldsFor = (keys: string[]) =>
    keys.map((key) =>
      renderField(ALL_ITEM_FIELDS.find((field) => field.key === key)!),
    );
  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${styles.createDialog}`}
      aria-labelledby="product-editor-title"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
      }}
      onClose={() => {
        if (!dialog.current?.open) {
          preparation.current?.abort();
          onClose(!!savedProduct);
        }
      }}
    >
      <form
        onSubmit={save}
        noValidate={!!item || !!savedProduct}
        aria-busy={saving || !!preparing}
        onInvalidCapture={(event) => {
          const section = (event.target as HTMLElement).closest("details");
          if (section) section.open = true;
        }}
      >
        <div className={styles.panelHeading}>
          <div>
            <div className={styles.eyebrow}>
              {item ? `EDIT ITEM · ${item.designNo}` : "GROW YOUR CATALOGUE"}
            </div>
            <h2 id="product-editor-title">
              {item ? "Edit product" : "Add product"}
            </h2>
            <p>{company?.name} · Fields marked * are required.</p>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={item ? "Close edit product" : "Close add product"}
            disabled={saving}
            onClick={() => dialog.current?.close()}
          >
            <X size={21} />
          </button>
        </div>
        <div className={styles.formBody}>
          {error && (
            <div
              ref={errorBox}
              className={styles.error}
              role="alert"
              tabIndex={-1}
            >
              <CircleAlert size={18} />
              <div>
                <p>{error}</p>
                {issues.length > 0 && (
                  <ul className={styles.rowErrors}>
                    {issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <fieldset
            disabled={saving || !!preparing}
            className={styles.formFields}
          >
            <section
              className={styles.formSection}
              aria-labelledby="product-photo-title"
            >
              <h3 id="product-photo-title">Product photos</h3>
              {existingPhotos.length > 0 && (
                <div
                  className={styles.galleryGrid}
                  aria-label="Existing product photos"
                >
                  {existingPhotos.map((url, index) => (
                    <div className={styles.galleryPhoto} key={url}>
                      <div className={styles.photoPreview}>
                        <ProductPhoto
                          src={url}
                          alt={`${item?.designNo ?? "Product"} photo ${index + 1}`}
                        />
                      </div>
                      <small>
                        {url === photoLink ? "Main photo" : "Gallery photo"}
                      </small>
                      {item &&
                        (url === item.values.image_url ||
                          item.images?.includes(url)) && (
                          <button
                            type="button"
                            className={styles.textButton}
                            aria-label={`Replace photo ${index + 1}`}
                            disabled={photos.some(
                              (photo) => photo.replaces === url,
                            )}
                            onClick={() => {
                              replacementTarget.current = url;
                              replacementInput.current?.click();
                            }}
                          >
                            {photos.some((photo) => photo.replaces === url)
                              ? "Replacement selected"
                              : "Replace"}
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.photoActions}>
                <button
                  type="button"
                  className={styles.photoUpload}
                  onClick={() => photoInput.current?.click()}
                >
                  <UploadCloud size={18} />
                  Add photos
                </button>
                <input
                  ref={photoInput}
                  type="file"
                  multiple
                  className={styles.srOnly}
                  aria-label="Choose product photos"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void choosePhotos(files);
                  }}
                />
                <input
                  ref={replacementInput}
                  type="file"
                  className={styles.srOnly}
                  aria-label="Choose replacement photo"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    const replaces = replacementTarget.current;
                    event.target.value = "";
                    replacementTarget.current = undefined;
                    if (file && replaces) void choosePhotos([file], replaces);
                  }}
                />
                <p>
                  Select up to {MAX_PRODUCT_PHOTOS} photos together. JPG, PNG or
                  WebP, up to 20 MB each. Large photos are automatically resized
                  for the website; your original files stay unchanged. Photos
                  are added to the gallery when you save. The first upload
                  becomes the main photo only if one is missing.
                </p>
                {item && (
                  <p>
                    Choose Replace on an existing photo to change it. Saving
                    uploads the replacement and deletes the old photo and
                    thumbnail from storage, unless another item still uses them.
                  </p>
                )}
              </div>
              {photos.length > 0 && (
                <div
                  className={styles.galleryGrid}
                  aria-label="Selected photos"
                >
                  {photos.map((photo) => (
                    <PhotoPreview
                      key={photo.id}
                      photo={photo}
                      onRemove={() =>
                        setPhotos((current) =>
                          current.filter((entry) => entry.id !== photo.id),
                        )
                      }
                    />
                  ))}
                </div>
              )}
              {progress && (
                <p className={styles.uploadProgress} role="status">
                  {progress}
                </p>
              )}
              {preparing && (
                <p className={styles.uploadProgress} role="status">
                  {preparing}
                </p>
              )}
            </section>
          </fieldset>
          <fieldset
            disabled={saving || !!savedProduct}
            className={styles.formFields}
          >
            <details className={styles.photoLinks}>
              <summary>Main photo and thumbnail links</summary>
              <div className={styles.formGrid}>
                {fieldsFor(["image_url", "thumb_url"])}
              </div>
            </details>
            <section
              className={styles.formSection}
              aria-labelledby="product-basics-title"
            >
              <h3 id="product-basics-title">Product details</h3>
              <div className={styles.formGrid}>{fieldsFor(basics)}</div>
            </section>
            <section
              className={styles.formSection}
              aria-labelledby="product-website-title"
            >
              <h3 id="product-website-title">Website details</h3>
              <div className={styles.formGrid}>{fieldsFor(website)}</div>
            </section>
            <details className={styles.moreFields}>
              <summary>
                More item details{" "}
                <span>Stock, dimensions, tax, video and variants</span>
              </summary>
              <div className={styles.formGrid}>
                {otherFields.map(renderField)}
              </div>
            </details>
            <datalist id="new-product-types">
              {data.itemTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </fieldset>
        </div>
        <div className={styles.formFooter}>
          <button
            type="button"
            className={styles.textButton}
            disabled={saving}
            onClick={() => dialog.current?.close()}
          >
            {savedProduct ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={saving || !!preparing}
          >
            {saving || preparing ? (
              <LoaderCircle size={17} className={styles.spin} />
            ) : item ? (
              <Save size={17} />
            ) : (
              <Plus size={17} />
            )}
            {preparing
              ? "Preparing photos…"
              : saving
                ? progress
                  ? "Uploading photos…"
                  : "Saving…"
                : savedProduct
                  ? photos.some((photo) => !photo.saved)
                    ? "Retry remaining photos"
                    : "Finish"
                  : item
                    ? "Save changes"
                    : "Add product"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
