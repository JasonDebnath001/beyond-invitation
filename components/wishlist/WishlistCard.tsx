"use client";

import { useRef, useState } from "react";
import Image from "@/components/ProductImage";
import Link from "next/link";
import { ImageOff, X } from "lucide-react";
import { discountPercent, type Product } from "@/types";
import { getProductQuantityRules } from "@/lib/product-quantity";
import { formatProductName } from "@/lib/product-name";
import AddToCartButton from "@/components/AddToCartButton";
import ProductPrice from "@/components/ProductPrice";
import WishlistButton from "@/components/WishlistButton";
import { getMainProductImage } from "./product-image";
import { focusClass } from "./WishlistUI";

export default function WishlistCard({ product, onRemove, mode = "own", disabled = false }: {
  product: Product & { subject?: string }; onRemove?: (slug: string, element: HTMLElement) => void;
  mode?: "own" | "shared"; disabled?: boolean;
}) {
  const article = useRef<HTMLElement>(null);
  const productName = formatProductName(product.name, product.printName);
  const [failedSrc, setFailedSrc] = useState("");
  const src = getMainProductImage(product.images);
  const discount = discountPercent(product);
  const { minimum } = getProductQuantityRules(product);

  return (
    <article ref={article} data-wishlist-card={product.slug} className="group relative flex h-full min-w-0 flex-col">
      <div className="relative isolate">
        <Link href={`/products/${product.slug}`} aria-label={`View ${productName}`} className={`relative flex aspect-square w-full items-center justify-center overflow-hidden focus-visible:ring-inset ${focusClass}`}>
          {src && src !== failedSrc ? (
            <Image src={src} alt={productName} fill sizes="(min-width:1800px) 419px, (min-width:1024px) calc(25vw - 31px), (min-width:768px) calc(33.333vw - 29.333px), (min-width:640px) calc(50vw - 34px), calc(50vw - 22px)"
              onError={() => setFailedSrc(src)} className="object-contain" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-4 text-center text-[#8b7561]">
              <ImageOff aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1} /><span className="text-xs">Image coming soon</span>
            </div>
          )}
        </Link>
        {discount > 0 && <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 bg-[#df270d] px-3 py-1 text-[11px] font-medium leading-4 text-white">−{discount}%</span>}
        {mode === "shared" ? <WishlistButton productSlug={product.slug} className="absolute right-2 top-2 z-20" /> : (
          <button type="button" aria-label="Remove from wishlist" title="Remove from wishlist" disabled={disabled || !onRemove}
            onClick={() => { if (article.current) onRemove?.(product.slug, article.current); }}
            className={`absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#e9e1d7] bg-white/95 text-[#78695d] opacity-100 transition-[color,opacity] hover:text-carbon disabled:cursor-wait md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(hover:none)]:!opacity-100 ${focusClass}`}>
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
        <div className="product-card-cart absolute inset-x-3 bottom-4 z-10">
          <AddToCartButton product={product} variant="card" />
        </div>
      </div>
      <div className="min-w-0 pt-2">
        <Link href={`/products/${product.slug}`} className={focusClass}>
          <h2 title={productName} className="break-words text-[13px] font-normal leading-[1.45] tracking-[0.035em] text-[#161616] hover:underline hover:underline-offset-4 sm:text-[16px]">{productName}</h2>
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <ProductPrice price={product.price} mrp={product.mrp} variant="card" />
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#78695d] sm:text-xs">Min. {minimum} pieces</p>
      </div>
    </article>
  );
}
