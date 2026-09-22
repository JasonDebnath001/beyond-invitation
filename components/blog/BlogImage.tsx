"use client";

import { useState } from "react";
import { Flower2 } from "lucide-react";
import { safeBlogImage } from "@/lib/blog";
import styles from "./Blog.module.css";

export default function BlogImage({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState("");
  if (!safeBlogImage(src) || failed === src)
    return (
      <div
        className={styles.imagePlaceholder}
        aria-label={alt || "Beyond Invitation journal"}
        role="img"
      >
        <Flower2 size={64} strokeWidth={0.7} />
        <span>BEYOND INVITATION</span>
        <small>Stories worth keeping</small>
      </div>
    );
  // External editorial images are served directly; no remote image proxy is needed.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(src)}
      className={styles.image}
    />
  );
}
