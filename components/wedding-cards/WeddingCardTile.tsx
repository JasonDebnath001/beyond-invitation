"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import WishlistButton from "@/components/WishlistButton";
import AddToCartButton from "@/components/AddToCartButton";
import ProductPrice from "@/components/ProductPrice";
import type { Product } from "@/types";
import type { BrowserProduct } from "@/lib/wedding-cards";

export default function WeddingCardTile({
  product,
  priority = false,
}: {
  product: BrowserProduct;
  priority?: boolean;
}) {
  const [failedImage, setFailedImage] = useState("");
  const hasImage = !!product.image && failedImage !== product.image;
  const named =
    !!product.name.trim() && product.name.trim() !== product.designNo;
  const title = named ? product.name : `Design ${product.designNo}`;
  const cartProduct: Product & { subject: string; minOrderQty: number | null } =
    {
      slug: product.slug,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      images: product.image ? [product.image] : [],
      itemCode: product.designNo,
      itemGroup: product.itemGroup,
      subject: product.subject,
      minOrderQty: product.minOrderQty,
      category: "wedding",
      emoji: "",
      description: "",
    };

  return (
    <article
      data-card={product.slug}
      data-flip-id={product.slug}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-carbon/10 bg-white transition-colors duration-200 hover:border-carbon/30 focus-within:border-carbon/40"
    >
      <div className="relative">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${title}`}
          className="relative block aspect-[4/5] overflow-hidden bg-[#f8f5f0]"
        >
          {hasImage ? (
            <>
              <Image
                priority={priority}
                src={
                  /^(https?:\/\/|\/)/.test(product.image)
                    ? product.image
                    : `/products/${product.image}`
                }
                alt={title}
                fill
                sizes="(min-width:1280px) 225px, (min-width:1024px) 24vw, (min-width:768px) 30vw, 46vw"
                className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none sm:p-4"
                onError={() => setFailedImage(product.image)}
              />
              {product.imageCount > 1 ? (
                <span className="absolute bottom-2 left-2 rounded-sm bg-white/90 px-2 py-1 text-[10px] text-ink-mid">
                  {product.imageCount} photos
                </span>
              ) : null}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#f1eee8] px-3 text-center">
              <span className="max-w-full break-words text-[32px] font-light tracking-[-0.03em] text-[#50101f]/60">
                {product.designNo}
              </span>
              <span className="text-xs text-ink-mid">Photo on request</span>
            </div>
          )}
        </Link>
        <WishlistButton
          productSlug={product.slug}
          className="absolute right-1 top-1 z-20 sm:right-2 sm:top-2"
        />
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
        <p
          title={product.itemGroup}
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b6f47] [overflow-wrap:anywhere]"
        >
          {product.itemGroup}
          {named ? (
            <span className="block">Design {product.designNo}</span>
          ) : null}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-1.5 rounded-sm focus-visible:outline-gold"
        >
          <h3 className="line-clamp-2 text-[15px] font-semibold text-[#2a1810]">
            {title}
          </h3>
        </Link>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2">
          <ProductPrice
            price={product.price}
            mrp={product.mrp}
            priceClassName={
              product.hasPrice
                ? "text-lg font-bold leading-6 tracking-tight text-[#2a1810] sm:text-xl"
                : "text-sm font-semibold leading-6 text-[#2a1810]"
            }
            oldPriceClassName="text-xs text-[#85776b] sm:text-[13px]"
          />
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#78695d] sm:text-xs">
          Min. {product.minOrderQty || 50} pieces
        </p>
        <div className="mt-auto pt-3.5">
          <AddToCartButton product={cartProduct} variant="card" />
        </div>
      </div>
    </article>
  );
}
