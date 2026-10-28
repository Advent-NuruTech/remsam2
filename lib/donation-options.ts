export const DONATION_CURRENCIES = ["KES", "USD"] as const;
export type DonationCurrency = (typeof DONATION_CURRENCIES)[number];

/** Donations intentionally use clear, fixed choices rather than free-form input. */
export const DONATION_AMOUNTS = {
  KES: [500, 1_000, 2_500, 5_000, 10_000] as const,
  USD: [5, 10, 25, 50, 100] as const,
} as const;

export const DONATION_QUOTE_TTL_MS = 5 * 60 * 1_000;

export function isDonationCurrency(value: unknown): value is DonationCurrency {
  return value === "KES" || value === "USD";
}

export function isPresetDonationAmount(currency: DonationCurrency, value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && DONATION_AMOUNTS[currency].includes(value as never);
}
