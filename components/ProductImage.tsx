"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/** Keep product photos visible if the hosted image optimizer is unavailable. */
export default function ProductImage({ src, alt, unoptimized, onError, ...props }: ImageProps) {
  const source = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const [directSource, setDirectSource] = useState<string>();
  const direct = unoptimized || directSource === source;

  return (
    <Image
      {...props}
      key={`${source}:${direct ? "direct" : "optimized"}`}
      src={src}
      alt={alt}
      unoptimized={direct}
      onError={(event) => {
        if (!direct) {
          // Retry the original before letting the caller show a missing-photo placeholder.
          setDirectSource(source);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
