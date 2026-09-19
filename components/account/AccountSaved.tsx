import Image from "next/image";
import Link from "next/link";
import { Heart, ArrowUpRight } from "lucide-react";
import ProductPrice from "@/components/ProductPrice";
import type { SavedProduct } from "@/lib/account";
import { formatProductName } from "@/lib/product-name";
import { cardClass, focusClass, linkClass, secondaryClass, SectionHeading } from "./AccountUI";

export default function AccountSaved({ products }: { products: SavedProduct[] }) {
  return (
    <section id="saved" aria-labelledby="saved-heading" data-motion="section" className={cardClass}>
      <SectionHeading id="saved-heading">Your shortlist</SectionHeading>
      {products.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
          {products.slice(0, 6).map((product) => (
            <Link key={product.slug} href={`/products/${product.slug}`} className={`group min-w-0 rounded-xl ${focusClass}`}>
              <div className="relative aspect-square overflow-hidden rounded-xl border border-gold/15 bg-paper">
                {product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="(min-width:1024px) 160px, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <Heart aria-hidden="true" className="absolute inset-0 m-auto h-7 w-7 text-[#a7772d]" strokeWidth={1} />}
              </div>
              <h3 className="mt-3 break-words text-sm font-semibold leading-5 text-carbon">{formatProductName(product.name, product.itemCode)}</h3>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs leading-5"><ProductPrice price={product.price} mrp={product.mrp} priceClassName="text-ink-mid" oldPriceClassName="text-ink-mid" /></div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gold/30 px-5 py-10 text-center">
          <Heart aria-hidden="true" className="mx-auto h-7 w-7 text-[#a7772d]" strokeWidth={1.2} />
          <p className="mt-4 text-base text-ink-mid">Nothing saved yet.</p>
          <Link href="/wedding-cards" className={`mt-5 ${secondaryClass}`}>Explore wedding cards<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      )}
      <Link href="/wishlist" className={`mt-6 ${linkClass}`}>View all saved designs<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
    </section>
  );
}
