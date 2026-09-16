import Link from "next/link";
import { getCatalogProducts, type CatalogProduct } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product Catalogue – Beyond Invitation",
  description: "Explore invitation cards, wedding boxes and celebration stationery from Beyond Invitation.",
};

export default async function CatalogPage() {
  let products: CatalogProduct[] = [];
  let failed = false;

  try {
    products = await getCatalogProducts();
  } catch (error) {
    console.error("Catalogue page failed:", error);
    failed = true;
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-paper">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gold">
            Explore the collection
          </p>
          <h1 className="font-display text-4xl font-semibold text-carbon md:text-5xl">
            Product Catalogue
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink/70 md:text-base">
            Discover invitations and celebration stationery for your special occasion.
          </p>
        </div>
        {failed ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-gold/30 bg-white p-6 text-center text-ink">
            <h2 className="mb-2 text-lg font-semibold">Couldn&apos;t load the catalogue</h2>
            <p className="text-sm leading-6">Please try again shortly or contact us for help.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-gold/30 bg-white p-8 text-center shadow-sm">
            <h2 className="font-display text-2xl font-semibold text-carbon">No products found</h2>
            <p className="mt-3 text-sm leading-6 text-ink/70">Our collection is being updated. Please check back soon.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-gold/20 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-carbon">{products.length} products found</p>
              <Link href="/" className="inline-flex rounded-full border border-carbon px-5 py-2 text-sm font-semibold text-carbon transition hover:bg-carbon hover:text-white">
                Back to Home
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => <ProductCard key={product.slug} product={product} />)}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
