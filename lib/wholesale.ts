import type { Product, WholesaleTier } from "@/lib/types";

export function isWholesaleProduct(product: Pick<Product, "saleType">) {
  return product.saleType === "wholesale";
}

export function normalizedWholesaleTiers(tiers: WholesaleTier[] | undefined) {
  return [...(tiers ?? [])]
    .filter((tier) => Number.isInteger(tier.minQuantity) && tier.minQuantity > 0 && Number.isFinite(tier.price) && tier.price > 0)
    .sort((left, right) => left.minQuantity - right.minQuantity);
}

export function wholesaleMinimumQuantity(product: Pick<Product, "saleType" | "wholesaleTiers">) {
  return isWholesaleProduct(product) ? normalizedWholesaleTiers(product.wholesaleTiers)[0]?.minQuantity ?? 1 : 1;
}

export function wholesaleUnitPrice(product: Pick<Product, "saleType" | "wholesaleTiers" | "price">, quantity: number) {
  if (!isWholesaleProduct(product)) return product.price;
  const tier = normalizedWholesaleTiers(product.wholesaleTiers).filter((item) => item.minQuantity <= quantity).at(-1);
  return tier?.price ?? product.price;
}
