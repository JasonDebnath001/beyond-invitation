import { Suspense } from "react";
import Link from "next/link";
import type { CategorizedCatalogProduct } from "@/lib/catalog-item-category";
import type { BrowserProduct, WeddingCardType } from "@/lib/wedding-cards";
import { WeddingCardsMotion } from "@/components/wedding-cards/WeddingCardsMotion";
import WeddingCardsBrowser, { WeddingCardsSkeleton } from "@/components/wedding-cards/WeddingCardsBrowser";
import WeddingCardsFaq from "@/components/wedding-cards/WeddingCardsFaq";

export default function WeddingCardsCollection({
  title = "Wedding cards",
  products,
  collectionType,
  errorMessage = "",
  emptyTitle = "No wedding cards just yet",
}: {
  title?: string;
  products: CategorizedCatalogProduct[];
  collectionType?: WeddingCardType;
  errorMessage?: string;
  emptyTitle?: string;
}) {
  const browserProducts: BrowserProduct[] = products.map((product) => ({
    slug: product.slug,
    designNo: product.itemCode || product.slug,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    image: product.images[0] || "",
    imageCount: product.images.length,
    subject: product.subject,
    itemCategory: product.itemCategory,
    itemGroup: product.itemGroup,
    hasPrice: product.hasPrice,
    minOrderQty: product.minOrderQty,
    updatedAt: product.updatedAt,
  }));

  return (
    <WeddingCardsMotion>
      <section id="collection" aria-labelledby="wedding-cards-title" className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <header className="mb-3 sm:mb-5">
          <h1 id="wedding-cards-title" className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-maroon sm:text-[32px]">{title}</h1>
        </header>
        {errorMessage || !products.length ? (
          <div className="rounded-3xl border border-gold/20 bg-white/80 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-light text-maroon">
              {errorMessage ? "Unable to load wedding cards." : emptyTitle}
            </h2>
            <p className="mt-3 text-base leading-8 text-ink-mid">
              {errorMessage ? "Please try again, or contact us for available designs." : "This collection is being updated. Please check back soon or contact us for help finding your invitation."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="https://wa.me/917044815488" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-carbon px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-carbon-dark">
                Chat on WhatsApp
              </a>
              <Link href="/contact" className="inline-flex items-center justify-center rounded-full border border-carbon/20 bg-white px-6 py-3 text-sm font-semibold text-carbon transition-colors hover:bg-paper">
                Contact us
              </Link>
            </div>
          </div>
        ) : (
          <Suspense fallback={<WeddingCardsSkeleton />}>
            <WeddingCardsBrowser products={browserProducts} collectionType={collectionType} />
          </Suspense>
        )}
      </section>
      <WeddingCardsFaq />
    </WeddingCardsMotion>
  );
}
