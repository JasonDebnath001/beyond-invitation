"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, UploadCloud, X } from "lucide-react";
import { safeBlogImage } from "@/lib/blog";
import { blogRequest } from "@/lib/admin/blog-client";
import { prepareProductPhoto } from "@/lib/admin/item-photo-client";
import BlogImage from "@/components/blog/BlogImage";
import styles from "./BlogAdmin.module.css";

type PendingImage = {
  id: string;
  url: string;
  alt: string;
  file?: File;
  error?: string;
};

export default function BlogImagePicker({
  disabled,
  onBusyChange,
  onPendingChange,
  onInsert,
  onClose,
}: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onInsert: (markdown: string) => boolean;
  onClose: () => void;
}) {
  const [images, setImages] = useState<PendingImage[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const request = useRef<AbortController | null>(null);
  const busy = !!progress;
  const locked = disabled || busy;
  const pending = !!images.length || !!url.trim();

  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);
  useEffect(() => () => request.current?.abort(), []);

  async function upload(batch: PendingImage[]) {
    if (disabled || request.current || !batch.length) return;
    const controller = new AbortController();
    request.current = controller;
    onBusyChange(true);
    setError("");
    try {
      // Prepare sequentially so several large originals do not exhaust memory.
      for (const [index, item] of batch.entries()) {
        if (controller.signal.aborted) break;
        setProgress(`Uploading image ${index + 1} of ${batch.length}...`);
        setImages((current) => current.map((image) =>
          image.id === item.id ? { ...image, error: undefined } : image,
        ));
        try {
          const prepared = await prepareProductPhoto(item.file!, controller.signal);
          if (controller.signal.aborted) break;
          const form = new FormData();
          form.set("image", prepared);
          const result = await blogRequest<{ url: string }>("/api/admin/blogs/images", {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
          if (controller.signal.aborted) break;
          if (!safeBlogImage(result.url)) throw new Error("The upload returned an invalid image URL. Please retry.");
          setImages((current) => current.map((image) =>
            image.id === item.id ? { ...image, url: result.url, file: undefined, error: undefined } : image,
          ));
        } catch (cause) {
          if (controller.signal.aborted) break;
          setImages((current) => current.map((image) =>
            image.id === item.id
              ? { ...image, error: cause instanceof Error ? cause.message : "Upload failed. Please retry." }
              : image,
          ));
        }
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) {
        setProgress("");
        onBusyChange(false);
      }
    }
  }

  function insertImages() {
    if (locked) return;
    if (url.trim()) {
      setError("Add the image URL to the selection or clear it before inserting.");
      return;
    }
    if (!images.length || images.some((image) => !safeBlogImage(image.url) || !image.alt.trim())) {
      setError("Upload each image and add a short description before inserting. Retry or remove any failed uploads.");
      return;
    }
    const markdown = images.map((image) => {
      const alt = image.alt.trim().replace(/[\\[\]*_`<>]/g, "\\$&").replace(/[\r\n]/g, " ");
      return `![${alt}](<${image.url}>)`;
    }).join("\n\n");
    if (onInsert(`\n\n${markdown}\n\n`)) {
      setImages([]);
      setError("");
      onPendingChange(false);
      onClose();
    }
  }

  return (
    <div className={styles.mediaPanel} aria-label="Add article images">
      <div className={styles.mediaHeading}>
        <strong>Add images to your story</strong>
        <button type="button" aria-label="Close image panel" disabled={locked} onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <p className={styles.mediaHint}>Choose several photos, describe each one, then insert them into your article.</p>
      <label className={styles.uploadInline}>
        <UploadCloud size={16} />
        Upload images
        <input
          type="file"
          multiple
          aria-label="Upload article images"
          accept="image/jpeg,image/png,image/webp"
          disabled={locked}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (locked || request.current || !files.length) return;
            const batch = files.map((file) => ({ id: crypto.randomUUID(), url: "", alt: "", file }));
            setImages((current) => [...current, ...batch]);
            void upload(batch);
          }}
        />
      </label>
      <div className={styles.mediaUrlRow}>
        <label className={styles.field}>
          Or paste an image URL
          <input
            value={url}
            maxLength={2048}
            placeholder="https://..."
            disabled={locked}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <button type="button" className={styles.secondary} disabled={locked} onClick={() => {
          const imageUrl = url.trim();
          if (!safeBlogImage(imageUrl)) {
            setError("Use an HTTPS image URL or a local image path.");
            return;
          }
          setImages((current) => [...current, { id: crypto.randomUUID(), url: imageUrl, alt: "" }]);
          setUrl("");
          setError("");
        }}>Add URL</button>
      </div>
      {!!images.length && (
        <ol className={styles.mediaGrid} aria-label="Selected article images">
          {images.map((image, index) => (
            <li key={image.id} className={styles.mediaCard}>
              <div className={styles.mediaPreview}>
                {image.url ? <BlogImage src={image.url} alt={image.alt} /> : <ImagePlus size={30} />}
              </div>
              <div className={styles.mediaCardHeading}>
                <span title={image.file?.name}>Image {index + 1}{image.file ? `: ${image.file.name}` : ""}</span>
                <button type="button" aria-label={`Remove image ${index + 1}`} disabled={locked} onClick={() => {
                  setImages((current) => current.filter((item) => item.id !== image.id));
                  setError("");
                }}><X size={16} /></button>
              </div>
              <label className={styles.field}>
                Image {index + 1} description
                <input value={image.alt} maxLength={250} disabled={disabled} placeholder="Describe what the image shows" onChange={(event) => {
                  const alt = event.target.value;
                  setImages((current) => current.map((item) => item.id === image.id ? { ...item, alt } : item));
                }} />
              </label>
              {image.error && <p className={styles.errorText} role="alert">{image.error}</p>}
            </li>
          ))}
        </ol>
      )}
      {progress && <p className={styles.mediaProgress} role="status"><LoaderCircle size={16} className={styles.spin} />{progress}</p>}
      {error && <p className={styles.errorText} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className={styles.secondary} type="button" disabled={locked || !images.length} onClick={insertImages}>
          Insert {images.length || ""} {images.length === 1 ? "image" : "images"} <ImagePlus size={15} />
        </button>
        {images.some((image) => image.error) && <button className={styles.secondary} type="button" disabled={locked} onClick={() => void upload(images.filter((image) => image.error && image.file))}>Retry failed uploads</button>}
      </div>
      <small>JPG, PNG or WebP, up to 20 MB each. Images are resized automatically. Use Preview to see all your article images.</small>
    </div>
  );
}
