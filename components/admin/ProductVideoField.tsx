"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { PRODUCT_VIDEO_ACCEPT } from "@/lib/admin/item-video-fields";
import styles from "./ItemDashboard.module.css";

export type QueuedVideo = { id: string; file: File; saved?: boolean; url?: string; error?: string };

export default function ProductVideoField({ video, link, originalSource, locked, onChoose, onLinkChange, onRemove }: {
  video: QueuedVideo | null;
  link: string;
  originalSource: string;
  locked: boolean;
  onChoose: (file: File) => void;
  onLinkChange: (value: string) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const file = video?.file;
  useEffect(() => {
    setPreviewFailed(false);
    if (!file) { setLocalUrl(""); return; }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, link]);
  let preview = "";
  let safeLink = "";
  try {
    const url = new URL(link);
    if (["http:", "https:"].includes(url.protocol)) {
      safeLink = url.href;
      if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(url.pathname)) preview = safeLink;
    }
  } catch { /* The URL field reports incomplete links on save. */ }
  preview = video ? localUrl : preview;
  return (
    <section className={styles.formSection} aria-labelledby="product-video-title">
      <h3 id="product-video-title">Product video</h3>
      <p className={styles.videoHelp}>Upload one MP4 or WebM video up to 50 MB, or paste a YouTube or public video link. The video appears after the product photos.</p>
      {preview && !previewFailed && (
        <video key={preview} src={preview} controls playsInline preload="metadata" className={styles.videoPreview}
          aria-label="Product video preview" onError={() => setPreviewFailed(true)} />
      )}
      {previewFailed && <p className={styles.videoHelp}>This browser cannot preview the video. MP4 with H.264 encoding is recommended.</p>}
      {!video && safeLink && <a className={styles.textButton} href={safeLink} target="_blank" rel="noreferrer">Open current video</a>}
      <fieldset disabled={locked} className={styles.formFields}>
        <div className={styles.actions}>
          <button type="button" className={styles.photoUpload} onClick={() => input.current?.click()}>
            <UploadCloud size={18} /> {video || link ? "Replace video" : "Add video"}
          </button>
          <input ref={input} type="file" accept={PRODUCT_VIDEO_ACCEPT} className={styles.srOnly} aria-label="Choose product video"
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onChoose(file); }} />
          {video && !video.saved && <button type="button" className={styles.textButton} onClick={onRemove}>Cancel selected video</button>}
          {!video && link && <button type="button" className={styles.textButton} onClick={() => onLinkChange("")}>Remove video</button>}
        </div>
        {video && <p className={styles.videoHelp}>{video.file.name} - {video.saved ? "Video saved" : video.error ? "Retry required" : "Ready to upload when you save"}</p>}
        {video?.error && <p className={styles.videoError}>{video.error}</p>}
        <div className={styles.formField}>
          <label htmlFor="product-video-link">Video link</label>
          <input id="product-video-link" name="video_url" type="url" maxLength={2000} disabled={!!video}
            placeholder="https://www.youtube.com/watch?v=..." value={link}
            onChange={(event) => onLinkChange(event.target.value)} aria-describedby="product-video-hint" />
          <input type="hidden" name="video_source" disabled={!!video} value={originalSource} />
          <small id="product-video-hint">Changes take effect when you save. A new video replaces this item&apos;s current video.</small>
        </div>
      </fieldset>
    </section>
  );
}
