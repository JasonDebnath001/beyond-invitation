import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import ProductCard from "@/components/ProductCard";
import { getWishlistProducts } from "@/lib/erp-wishlist";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">My Wishlist</h1>

        <p className="mt-4 text-gray-600">
          Please sign in to view and save your favourite products.
        </p>

        <div className="mt-8">
          <SignInButton mode="modal">
            <button className="rounded-full bg-black px-6 py-3 text-white transition hover:bg-gray-800">
              Sign in
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  const wishlistItems = await getWishlistProducts(userId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">My Wishlist</h1>
        <p className="mt-2 text-gray-600">
          Products you saved for later.
        </p>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="text-xl font-medium">Your wishlist is empty</h2>
          <p className="mt-2 text-gray-600">
            Start adding your favourite wedding cards, shagun envelopes, and
            packaging products.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wishlistItems.map((item) => {
            if (!item) return null;

            return (
              <ProductCard
                key={item.wishlistRecordName}
                product={item.product}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}