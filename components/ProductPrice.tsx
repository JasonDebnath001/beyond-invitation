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
  oldPriceClassName = "text-ink-mid",
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
          <del className="max-w-full break-words text-sm font-normal leading-normal text-neutral-600 decoration-[#b91c0c]">
            <span className="sr-only">Old price: </span>
            {cardPrice(mrp)}
          </del>
        )}
        <span
          className={`max-w-full break-words text-base font-semibold leading-normal ${hasPrice ? "text-[#b91c0c]" : "text-neutral-600"}`}
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
