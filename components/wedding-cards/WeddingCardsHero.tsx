import Image from "next/image";
import Link from "next/link";
import type { BrowserProduct } from "@/lib/wedding-cards";

export default function WeddingCardsHero({
  products,
}: {
  products: BrowserProduct[];
}) {
  const photos = products.filter((product) => product.image).slice(0, 4);
  if (!photos.length)
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-gold/20 bg-[#f3e7cf] px-8 py-16 text-center text-4xl font-light tracking-tight text-maroon">
        Beyond Invitation
      </div>
    );
  return (
    <div
      className={`mx-auto grid w-full gap-3 ${photos.length === 4 ? "max-w-[420px] grid-cols-2" : "grid-flow-col auto-cols-fr"}`}
    >
      {photos.map((product, index) => (
        <Link
          key={product.slug}
          data-motion="mosaic"
          href={`/products/${product.slug}`}
          aria-label={`View design ${product.designNo}`}
          className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#f3e7cf] focus-visible:outline-gold"
        >
          <Image
            src={
              /^(https?:\/\/|\/)/.test(product.image)
                ? product.image
                : `/products/${product.image}`
            }
            alt={`Wedding invitation design ${product.designNo}`}
            fill
            sizes="(min-width:1024px) 22vw, 45vw"
            priority={index < 2}
            className="object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-carbon/80 to-transparent px-4 pb-4 pt-12 text-[11px] font-bold uppercase tracking-[0.16em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Design {product.designNo}
          </span>
        </Link>
      ))}
    </div>
  );
}
