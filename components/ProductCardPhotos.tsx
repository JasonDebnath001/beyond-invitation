"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Product } from "@/types";
import Link from "@/components/NavigationLink";
import ProductImage from "@/components/ProductImage";

interface CardPhotosProps {
  product: Product;
  title: string;
  src: string;
  imageSizes: string;
  priority: boolean;
  discount: number;
  placeholderLabel: string;
}

export default function ProductCardPhotos({
  product,
  title,
  src,
  imageSizes,
  priority,
  discount,
  placeholderLabel,
}: CardPhotosProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src && !failed);

  return (
    <div className="relative isolate col-start-1 row-start-1">
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${title}`}
        className="product-card-image relative flex aspect-square w-full items-center justify-center overflow-hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-carbon"
      >
        {hasImage ? (
          <ProductImage
            key={src}
            src={src}
            alt={title}
            fill
            sizes={imageSizes}
            quality={75}
            storageTransform
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            unoptimized={src.startsWith("http://")}
            onError={() => setFailed(true)}
            className="object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-neutral-400">
            <ImageOff aria-hidden="true" className="h-8 w-8" strokeWidth={1} />
            <span className="text-xs">{placeholderLabel}</span>
          </div>
        )}
      </Link>

      {discount > 0 && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 bg-[#df270d] px-3 py-1 text-[11px] font-medium leading-4 text-white">
          −{discount}%
        </span>
      )}
    </div>
  );
}
