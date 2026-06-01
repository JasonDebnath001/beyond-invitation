import {
  getSaleProducts,
  getPremiumProducts,
  getAllCategories,
} from "@/lib/products";
import {
  BrandStatement,
  CelebrationGrid,
  FeatureStrip,
  WhyUs,
  Testimonials,
  Milestones,
} from "@/components/Sections";
import HeroCarousel from "@/components/HeroCarousel";
import { ProductSection } from "@/components/ProductGrid";

/**
 * Homepage. A server component — data is fetched on the server at build /
 * request time. No client-side data loading, fast first paint.
 */
export default async function HomePage() {
  const [saleProducts, premiumProducts, categories] = await Promise.all([
    getSaleProducts(),
    getPremiumProducts(),
    getAllCategories(),
  ]);

  return (
    <>
      <HeroCarousel />
      <BrandStatement />
      <CelebrationGrid categories={categories} />

      <ProductSection
        label=""
        title="Trendy Collection"
        products={saleProducts}
        viewAllHref="/collections/wedding"
        viewAllText="View All Sale Items"
      />

      <FeatureStrip />

      <ProductSection
        label="Exclusive & elegant"
        title="Premium Invitations"
        products={premiumProducts}
        viewAllHref="/collections/luxe"
        viewAllText="View All Premium Cards"
        shaded
      />

      <WhyUs />
      <Testimonials />
      <Milestones />
    </>
  );
}