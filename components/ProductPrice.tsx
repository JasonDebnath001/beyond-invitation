import type { Product } from "@/types";

type ProductPriceProps = Pick<Product, "price"> & {
  mrp?: number;
  priceClassName?: string;
  oldPriceClassName?: string;
  unavailableLabel?: string;
  variant?: "default" | "card";
};

/** The old price is informational; cart totals always use the selling price. */
export default function ProductPrice({
  price,
  mrp = price,
  priceClassName = "",
  oldPriceClassName = "text-ink-light",
  unavailableLabel = "Price on request",
  variant = "default",
}: ProductPriceProps) {
  const hasPrice = Number.isFinite(price) && price > 0;
  const showOldPrice = hasPrice && Number.isFinite(mrp) && mrp > price;
  const formatPrice = (value: number) =>
    `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  if (variant === "card") {
    const cardPrice = (value: number) =>
      `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return (
      <>
        {showOldPrice && (
          <del className="whitespace-nowrap text-[12px] font-normal tracking-[0.03em] text-neutral-500 decoration-[#dc2b18] sm:text-[14px]">
            <span className="sr-only">Old price: </span>
            {cardPrice(mrp)}
          </del>
        )}
        <span
          className={`text-[13px] font-normal tracking-[0.05em] sm:text-[16px] ${hasPrice ? "text-[#ed210b]" : "text-neutral-600"}`}
        >
          {hasPrice ? (
            <>
              <span className="sr-only">Current price: </span>
              {cardPrice(price)}
            </>
          ) : (
            unavailableLabel
          )}
        </span>
      </>
    );
  }

  return (
    <>
      <span className={priceClassName}>
        {hasPrice ? (
          <>
            <span className="sr-only">Current price: </span>
            {formatPrice(price)}
          </>
        ) : (
          unavailableLabel
        )}
      </span>
      {showOldPrice && (
        <del className={`whitespace-nowrap line-through ${oldPriceClassName}`}>
          <span className="sr-only">Old price: </span>
          {formatPrice(mrp)}
        </del>
      )}
    </>
  );
}
