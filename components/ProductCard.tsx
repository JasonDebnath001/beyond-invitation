import Link from "next/link";
import type { Product } from "@/types";
import { discountPercent } from "@/types";
import ImageSlider from "./ImageSlider";
import AddToCartButton from "./AddToCartButton";

interface ProductCardProps {
  product: Product;
}

/**
 * A single product card. Renders the slider, name, price and add-to-cart.
 * Used everywhere products are listed — change this one file and every
 * grid on the site updates. This is the core fix for the maintainability
 * problem in the old single-file version.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const discount = discountPercent(product);

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/25 bg-white transition duration-200 hover:-translate-y-1 hover:border-gold hover:shadow-[0_10px_35px_rgba(123,28,46,0.1)]">
      <Link href={`/products/${product.slug}`}>
        <ImageSlider
          images={product.images}
          emoji={product.emoji}
          alt={product.name}
          badge={product.badge ?? (discount > 0 ? `–${discount}%` : undefined)}
          showThumbnails
          heightClass="h-56"
        />
      </Link>

      <div className="p-4 pt-2">
        <Link href={`/products/${product.slug}`}>
          <h3 className="mb-2 text-[13.5px] font-medium leading-snug text-ink hover:text-maroon">
            {product.name}
          </h3>
        </Link>

        <div className="mb-3 flex items-center gap-2.5">
          <span className="font-display text-[17px] font-semibold text-maroon">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          {product.mrp > product.price && (
            <span className="text-[13px] text-ink-light line-through">
              ₹{product.mrp.toLocaleString("en-IN")}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-xl bg-[#E8F7EE] px-2 py-0.5 text-[11px] font-semibold text-[#27A060]">
              –{discount}%
            </span>
          )}
        </div>

        <AddToCartButton product={product} />
      </div>
    </div>
  );
}
