import Link from "next/link";
import { fetchErpProducts } from "@/lib/erpnext";
import ProductCard from "@/components/ProductCard";
import { discountPercent } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "ERPNext Products – Beyond Invitation",
    description: "Products loaded directly from ERPNext.",
};

function formatCurrency(value: number) {
    return `₹${value.toLocaleString("en-IN")}`;
}

export default async function ErpProductsPage() {
    let products = [];
    let errorMessage = "";

    try {
        products = await fetchErpProducts();
    } catch (error) {
        errorMessage =
            error instanceof Error
                ? error.message
                : "Unable to fetch products from ERPNext.";
    }

    return (
        <main className="bg-paper min-h-screen">
            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="mb-10 text-center">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-gold">
                        ERPNext Live Products
                    </p>

                    <h1 className="font-display text-4xl font-semibold text-carbon md:text-5xl">
                        Product Collection
                    </h1>

                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink/70 md:text-base">
                        These products are coming directly from ERPNext Item and Item Price
                        records.
                    </p>
                </div>

                {errorMessage ? (
                    <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
                        <h2 className="mb-2 text-lg font-semibold">
                            ERPNext connection problem
                        </h2>

                        <p className="text-sm leading-6">{errorMessage}</p>

                        <div className="mt-4 rounded-xl bg-white p-4 text-sm text-red-800">
                            <p className="font-semibold">Please check:</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                <li>ERPNEXT_URL is correct</li>
                                <li>ERPNEXT_API_KEY is correct</li>
                                <li>ERPNEXT_API_SECRET is correct</li>
                                <li>The API user has permission for Item and Item Price</li>
                            </ul>
                        </div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="mx-auto max-w-3xl rounded-2xl border border-gold/30 bg-white p-8 text-center shadow-sm">
                        <h2 className="font-display text-2xl font-semibold text-carbon">
                            No products found
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-ink/70">
                            ERPNext connected successfully, but no visible products were
                            returned. Please check Item records, disabled status, and website
                            visibility fields.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-gold/20 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center">
                            <div>
                                <p className="text-sm font-semibold text-carbon">
                                    {products.length} products found
                                </p>
                                <p className="text-xs text-ink/60">
                                    Source: ERPNext Item + Item Price
                                </p>
                            </div>

                            <Link
                                href="/"
                                className="inline-flex rounded-full border border-carbon px-5 py-2 text-sm font-semibold text-carbon transition hover:bg-carbon hover:text-white"
                            >
                                Back to Home
                            </Link>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {products.map((product) => {
                                const discount = discountPercent(product);

                                return (
                                    <div
                                        key={product.itemCode}
                                        className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gold/15 transition hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        <ProductCard product={product} />

                                        <div className="border-t border-gold/10 px-5 py-4">
                                            <div className="space-y-2 text-xs text-ink/70">
                                                <p>
                                                    <span className="font-semibold text-carbon">
                                                        Item Code:
                                                    </span>{" "}
                                                    {product.itemCode}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-carbon">
                                                        Item Group:
                                                    </span>{" "}
                                                    {product.itemGroup || "Not set"}
                                                </p>

                                                <p className="break-all text-xs text-blue-700">
                                                    Image URL: {product.images?.[0] || "No image"}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-carbon">
                                                        Website Category:
                                                    </span>{" "}
                                                    {product.category}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-carbon">
                                                        Price:
                                                    </span>{" "}
                                                    {formatCurrency(product.price)}
                                                </p>

                                                <p>
                                                    <span className="font-semibold text-carbon">
                                                        MRP:
                                                    </span>{" "}
                                                    {formatCurrency(product.mrp)}
                                                </p>

                                                {discount > 0 && (
                                                    <p>
                                                        <span className="font-semibold text-carbon">
                                                            Discount:
                                                        </span>{" "}
                                                        {discount}% off
                                                    </p>
                                                )}

                                                {product.badge && (
                                                    <p>
                                                        <span className="font-semibold text-carbon">
                                                            Badge:
                                                        </span>{" "}
                                                        {product.badge}
                                                    </p>
                                                )}
                                            </div>

                                            {product.description && (
                                                <div
                                                    className="mt-4 line-clamp-3 text-xs leading-5 text-ink/60"
                                                    dangerouslySetInnerHTML={{
                                                        __html: product.description,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}