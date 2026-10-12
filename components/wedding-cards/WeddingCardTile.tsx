"use client";

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";
import type { BrowserProduct } from "@/lib/wedding-cards";

export default function WeddingCardTile({
  product,
  priority = false,
}: {
  product: BrowserProduct;
  priority?: boolean;
}) {
  const named =
    !!product.name.trim() && product.name.trim() !== product.designNo;
  const cardProduct: Product & { subject: string; minOrderQty: number | null } = {
    slug: product.slug,
    name: named ? product.name : "Design",
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
    <div data-card={product.slug} data-flip-id={product.slug} className="h-full min-w-0">
      {product.imageCount > 1 ? <span className="sr-only">{product.imageCount} photos</span> : null}
      <ProductCard
        product={cardProduct}
        categoryLabel={product.itemGroup}
        priority={priority}
        imageCount={product.imageCount}
        placeholderLabel="Photo on request"
        imageSizes="(min-width:1800px) 363px, (min-width:1024px) calc(25vw - 87px), (min-width:768px) calc(33.333vw - 29.333px), (min-width:640px) calc(50vw - 34px), calc(50vw - 22px)"
      />
    </div>
  );
}
