export const DONATION_CURRENCIES = ["KES", "USD"] as const;
export type DonationCurrency = (typeof DONATION_CURRENCIES)[number];

export const DONATION_QUOTE_TTL_MS = 5 * 60 * 1_000;
export const MAX_DONATION_AMOUNT = { KES: 10_000_000, USD: 100_000 } as const;

export function isDonationCurrency(value: unknown): value is DonationCurrency {
  return value === "KES" || value === "USD";
}

/** KES is charged in whole shillings; USD supports cents before conversion. */
export function isDonationAmount(currency: DonationCurrency, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > MAX_DONATION_AMOUNT[currency]) return false;
  const multiplier = currency === "USD" ? 100 : 1;
  return Number.isSafeInteger(Math.round(value * multiplier)) && Math.abs(value * multiplier - Math.round(value * multiplier)) < 0.000001;
}
