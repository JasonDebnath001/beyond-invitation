import Link from "next/link";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import ImageSlider from "./ImageSlider";
import AddToCartButton from "./AddToCartButton";

interface ProductCardProps {
  product: Product;
}

/**
 * A single product card — image frame, name, price and add-to-cart.
 * Used everywhere products are listed: change this one file and every
 * grid on the site updates.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const discount = discountPercent(product);

  return (
    <div className="group flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="block overflow-hidden border border-neutral-200 bg-white transition-colors duration-300 group-hover:border-carbon"
      >
        <ImageSlider
          images={product.images}
          emoji={product.emoji}
          alt={product.name}
          badge={
            product.badge ?? (discount > 0 ? `${discount}% off` : undefined)
          }
          showThumbnails
          heightClass="h-60"
        />
      </Link>

      <div className="flex flex-1 flex-col pt-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="text-[13.5px] font-medium leading-snug text-carbon transition-colors group-hover:text-neutral-500">
            {product.name}
          </h3>
        </Link>

        <div className="mb-4 mt-2 flex items-baseline gap-2.5">
          <span className="font-display text-[18px] font-medium text-carbon">
            &#8377;{product.price.toLocaleString("en-IN")}
          </span>
          {product.mrp > product.price && (
            <span className="text-[12.5px] text-neutral-400 line-through">
              &#8377;{product.mrp.toLocaleString("en-IN")}
            </span>
          )}
          {discount > 0 && (
            <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
              &minus;{discount}%
            </span>
          )}
        </div>

        <div className="mt-auto">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}