"use client";

import { useRef, useState } from "react";
import Image from "next/image";
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

const categoryLabels: Record<Product["category"], string> = {
  wedding: "Wedding invitation", housewarming: "Housewarming", "thread-ceremony": "Thread ceremony",
  "naming-ceremony": "Naming ceremony", birthday: "Birthday invitation", "baby-shower": "Baby shower", luxe: "Luxe collection",
};

export default function WishlistCard({ product, onRemove, mode = "own", disabled = false }: {
  product: Product & { subject?: string }; onRemove?: (slug: string, element: HTMLElement) => void;
  mode?: "own" | "shared"; disabled?: boolean;
}) {
  const article = useRef<HTMLElement>(null);
  const productName = formatProductName(product.name, product.itemCode);
  const [failedSrc, setFailedSrc] = useState("");
  const src = getMainProductImage(product.images);
  const hasPrice = Number.isFinite(product.price) && product.price > 0;
  const discount = discountPercent(product);
  const { minimum } = getProductQuantityRules(product);
  const badge = product.badge || (product.onSale ? "On sale" : product.isPremium ? "Premium" : "");
  const label = product.subject || categoryLabels[product.category];

  return (
    <article ref={article} data-wishlist-card={product.slug} className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gold/20 bg-white transition-[border-color,box-shadow] duration-300 hover:border-[#ccb894] hover:shadow-[0_14px_36px_-24px_rgba(80,16,31,0.45)] focus-within:border-carbon/40 motion-reduce:transition-none">
      <div className="relative isolate">
        <Link href={`/products/${product.slug}`} aria-label={`View ${productName}`} className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#f8f5f0] focus-visible:ring-inset ${focusClass}`}>
          {src && src !== failedSrc ? (
            <Image src={src} alt={productName} fill sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw"
              onError={() => setFailedSrc(src)} className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none sm:p-4" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-4 text-center text-[#8b7561]">
              <ImageOff aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1} /><span className="text-xs">Image coming soon</span>
            </div>
          )}
        </Link>
        {badge && <span title={badge} className="pointer-events-none absolute left-0 top-3 z-10 max-w-[calc(100%-3.5rem)] truncate rounded-r-sm border-l-2 border-[#b38a45] bg-[#f4e7cb] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#63491f] sm:px-2.5 sm:text-[10px]">{badge}</span>}
        {mode === "shared" ? <WishlistButton productSlug={product.slug} className="absolute right-2 top-2 z-20" /> : (
          <button type="button" aria-label="Remove from wishlist" title="Remove from wishlist" disabled={disabled || !onRemove}
            onClick={() => { if (article.current) onRemove?.(product.slug, article.current); }}
            className={`absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#e9e1d7] bg-white/95 text-[#78695d] opacity-100 transition-[color,opacity] hover:text-carbon disabled:cursor-wait md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(hover:none)]:!opacity-100 ${focusClass}`}>
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
        <p title={label} className="mb-1.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b6f47]">{label}</p>
        <Link href={`/products/${product.slug}`} className={`rounded-sm ${focusClass}`}>
          <h2 title={productName} className="min-h-[2.75rem] break-words text-[15px] font-semibold leading-[1.375rem] text-[#2a1810]">{productName}</h2>
        </Link>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2">
          <ProductPrice price={product.price} mrp={product.mrp}
            priceClassName={hasPrice ? "text-lg font-bold leading-6 tracking-tight text-[#2a1810] sm:text-xl" : "text-sm font-semibold leading-6 text-[#2a1810]"}
            oldPriceClassName="text-xs text-[#85776b] sm:text-[13px]" />
          {discount > 0 && <span className="whitespace-nowrap text-[11px] font-bold text-[#3f6b4e] sm:text-xs">{discount}% off</span>}
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#78695d] sm:text-xs">Min. {minimum} pieces</p>
        <div className="mt-auto pt-3.5"><AddToCartButton product={product} variant="card" /></div>
      </div>
    </article>
  );
}
