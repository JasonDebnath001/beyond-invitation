"use client";

import Image, { getImageProps, type ImageProps } from "next/image";
import { useState } from "react";
import { getStorageImageUrl, storageImageLoader } from "@/lib/product-image-loader";

export type ProductImageProps = ImageProps & { storageTransform?: boolean };

function canTransform(src: ImageProps["src"], enabled?: boolean) {
  return enabled && typeof src === "string" && getStorageImageUrl(src, 1) !== null;
}

/** Keep gallery prefetch URLs identical to the responsive image's URLs. */
export function getProductImageProps({ storageTransform, ...props }: ProductImageProps) {
  return getImageProps({
    ...props,
    loader: !props.unoptimized && !props.loader && canTransform(props.src, storageTransform)
      ? storageImageLoader : props.loader,
  });
}

/** Keep product photos visible if the hosted image optimizer is unavailable. */
export default function ProductImage({ src, alt, unoptimized, onError, storageTransform, loader, ...props }: ProductImageProps) {
  const source = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  const [fallback, setFallback] = useState<{ source: string; mode: "optimized" | "direct" }>();
  const failed = fallback?.source === source ? fallback.mode : undefined;
  const direct = unoptimized || failed === "direct";
  const transformed = !direct && !failed && !loader && canTransform(src, storageTransform);
  const mode = direct ? "direct" : transformed ? "storage" : "optimized";

  return (
    <Image
      {...props}
      key={`${source}:${mode}`}
      src={src}
      alt={alt}
      unoptimized={direct}
      loader={transformed ? storageImageLoader : loader}
      onError={(event) => {
        if (transformed) {
          // A disabled/unavailable storage transform can still use Next's optimizer.
          setFallback({ source, mode: "optimized" });
          return;
        }
        if (!direct) {
          // Retry the original before letting the caller show a missing-photo placeholder.
          setFallback({ source, mode: "direct" });
          return;
        }
        onError?.(event);
      }}
    />
  );
}
