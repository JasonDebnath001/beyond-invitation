"use client";

import Link from "@/components/NavigationLink";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import { formatProductName } from "@/lib/product-name";
import { getProductCardImages } from "@/lib/product-card-media";
import ProductPrice from "./ProductPrice";
import ProductCardPhotos from "./ProductCardPhotos";

interface ProductCardProps {
  product: Product & { subject?: string };
  categoryLabel?: string;
  imageSizes?: string;
  priority?: boolean;
  imageCount?: number;
  placeholderLabel?: string;
}

export default function ProductCard({
  product,
  imageSizes = "(min-width:1800px) 419px, (min-width:1024px) calc(25vw - 31px), (min-width:768px) calc(33.333vw - 29.333px), (min-width:640px) calc(50vw - 34px), calc(50vw - 22px)",
  priority = false,
  imageCount,
  placeholderLabel = "Image coming soon",
}: ProductCardProps) {
  const title = formatProductName(product.name, product.itemCode);
  const photos = getProductCardImages(product.images);
  const totalPhotos = imageCount ?? product.imageCount ?? photos.length;

  return (
    <article className="product-card group flex h-full min-w-0 flex-col">
      <ProductCardPhotos
        key={`${product.slug}:${totalPhotos}:${photos.join("|")}`}
        product={product}
        title={title}
        initialPhotos={photos}
        imageCount={totalPhotos}
        imageSizes={imageSizes}
        priority={priority}
        discount={discountPercent(product)}
        placeholderLabel={placeholderLabel}
      />
      <div className="pt-2">
        <Link href={`/products/${product.slug}`} className="block focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-carbon">
          <h3 className="break-words text-[13px] font-normal leading-[1.45] tracking-[0.035em] text-[#161616] hover:underline hover:underline-offset-4 sm:text-[16px]">
            {title}
          </h3>
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <ProductPrice price={product.price} mrp={product.mrp} variant="card" />
        </div>
      </div>
    </article>
  );
}
