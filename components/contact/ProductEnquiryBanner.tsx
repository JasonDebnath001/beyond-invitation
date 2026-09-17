"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { EnquiryProduct } from "@/lib/contact";

export default function ProductEnquiryBanner({
  product,
}: {
  product: EnquiryProduct;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = product.image;
  const src =
    image && (/^(https?:\/\/|\/)/.test(image) ? image : `/products/${image}`);

  return (
    <div
      data-motion="product-banner"
      className="flex items-start gap-3 rounded-2xl border border-gold/20 bg-paper/60 p-4"
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f8f5f0]">
        {src && !imageFailed ? (
          <Image
            src={src}
            alt={product.name}
            fill
            sizes="56px"
            className="object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImageOff
            size={18}
            aria-label="Image unavailable"
            className="text-ink-light"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-carbon">
          Enquiry for design {product.designNo}
        </p>
        <p className="mt-1 break-words text-sm text-ink-mid">{product.name}</p>
        {product.minOrderQty != null && product.minOrderQty > 0 ? (
          <p className="mt-1 text-xs text-ink-light">
            Min. {product.minOrderQty} pieces
          </p>
        ) : null}
        <Link
          href="/contact"
          className="mt-2 inline-block text-xs font-semibold text-carbon underline decoration-gold/50 underline-offset-4 hover:decoration-carbon"
        >
          Remove
        </Link>
      </div>
    </div>
  );
}
