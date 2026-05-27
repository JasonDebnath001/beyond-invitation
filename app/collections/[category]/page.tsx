import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategoryBySlug,
  getProductsByCategory,
  getAllCategories,
} from "@/lib/products";
import type { ProductCategory } from "@/types";
import FilterableProductGrid from "@/components/FilterableProductGrid";

// Next.js 15: params is a Promise and must be awaited.
interface PageProps {
  params: Promise<{ category: string }>;
}

/** Pre-render a page for every category. */
export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return { title: "Collection Not Found – Shahi Cards" };
  return {
    title: `${category.name} Invitations – Shahi Cards`,
    description: category.description,
  };
}

export default async function CollectionPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const products = await getProductsByCategory(
    categorySlug as ProductCategory,
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="mb-11 text-center">
        <div className="mb-3 text-5xl">{category.emoji}</div>
        <h1 className="font-display text-3xl font-semibold text-maroon-dark md:text-[38px]">
          {category.name}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] text-ink-mid">
          {category.description}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="h-px w-16 bg-gold/25" />
          <span className="text-sm text-gold">✦</span>
          <span className="h-px w-16 bg-gold/25" />
        </div>
      </div>

      <FilterableProductGrid products={products} />
    </div>
  );
}