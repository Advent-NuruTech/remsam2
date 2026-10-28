import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/auth";

const PAYSTACK_API = "https://api.paystack.co/transaction";

type PaystackApiResponse<T> = { status?: unknown; message?: unknown; data?: T };

type InitializeData = {
  authorization_url?: unknown;
  reference?: unknown;
};

type VerifyData = {
  reference?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  email?: unknown;
  id?: unknown;
  paid_at?: unknown;
  metadata?: unknown;
  customer?: { email?: unknown };
};

type ListData = VerifyData[];

export type PaystackVerification = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  email?: string;
  transactionId?: string;
  paidAt?: string;
  metadata?: unknown;
};

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new HttpError(503, "Secure payments are not configured yet. Please try again shortly.");
  return key;
}

async function paystackRequest<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_API}${path}`, {
      ...init,
      cache: "no-store",
      headers: { Authorization: `Bearer ${secretKey()}`, Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(502, "The payment service could not be reached. Please try again.");
  }

  const payload = await response.json().catch(() => null) as PaystackApiResponse<T> | null;
  if (!response.ok || !payload || payload.status !== true || !payload.data) {
    throw new HttpError(502, "The payment service could not start this transaction. Please try again.");
  }
  return payload.data;
}

function configuredCallbackUrl() {
  const explicit = process.env.PAYSTACK_CALLBACK_URL?.trim();
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = explicit || configuredSite;
  if (!candidate) throw new HttpError(503, "Secure payments need a configured site URL.");

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new HttpError(503, "Secure payments need a valid callback URL.");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new HttpError(503, "Secure payments need an HTTPS callback URL.");
  }
  return explicit ? url.toString() : new URL("/payment/verify", url.origin).toString();
}

export async function initializePaystackPayment(input: {
  email: string;
  amount: number;
  reference: string;
  orderId: string;
  orderNumber: string;
}) {
  const data = await paystackRequest<InitializeData>("/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: "KES",
      reference: input.reference,
      callback_url: configuredCallbackUrl(),
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
    }),
  });
  if (typeof data.authorization_url !== "string" || !data.authorization_url.startsWith("https://")) {
    throw new HttpError(502, "The payment service returned an invalid checkout URL.");
  }
  if (data.reference !== input.reference) {
    throw new HttpError(502, "The payment service returned an invalid transaction reference.");
  }
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export async function initializeDonationPaystackPayment(input: {
  email: string;
  amount: number;
  reference: string;
  donationId: string;
  purpose?: string;
  originalCurrency: "KES" | "USD";
  originalAmount: number;
  conversionRate?: number;
}) {
  const data = await paystackRequest<InitializeData>("/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      currency: "KES",
      reference: input.reference,
      callback_url: configuredCallbackUrl(),
      metadata: {
        kind: "donation",
        donationId: input.donationId,
        ...(input.purpose ? { purpose: input.purpose } : {}),
        originalCurrency: input.originalCurrency,
        originalAmount: input.originalAmount,
        ...(input.conversionRate ? { conversionRate: input.conversionRate } : {}),
      },
    }),
  });
  if (typeof data.authorization_url !== "string" || !data.authorization_url.startsWith("https://")) {
    throw new HttpError(502, "The payment service returned an invalid checkout URL.");
  }
  if (data.reference !== input.reference) {
    throw new HttpError(502, "The payment service returned an invalid transaction reference.");
  }
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export async function verifyPaystackPayment(reference: string): Promise<PaystackVerification> {
  const data = await paystackRequest<VerifyData>(`/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  if (
    typeof data.reference !== "string" ||
    typeof data.status !== "string" ||
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    typeof data.currency !== "string"
  ) {
    throw new HttpError(502, "The payment service returned incomplete verification data.");
  }
  return {
    reference: data.reference,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    ...(typeof data.email === "string" ? { email: data.email } : typeof data.customer?.email === "string" ? { email: data.customer.email } : {}),
    ...(typeof data.id === "string" || typeof data.id === "number" ? { transactionId: String(data.id) } : {}),
    ...(typeof data.paid_at === "string" ? { paidAt: data.paid_at } : {}),
    metadata: data.metadata,
  };
}

/** Fetch recent provider records for the administrator's reconciliation view. */
export async function listPaystackPayments(): Promise<PaystackVerification[]> {
  const data = await paystackRequest<ListData>("?perPage=100", { method: "GET" });
  if (!Array.isArray(data)) throw new HttpError(502, "The payment service returned invalid payment records.");
  return data.flatMap((payment) => {
    if (typeof payment.reference !== "string" || typeof payment.status !== "string" || typeof payment.amount !== "number" || !Number.isSafeInteger(payment.amount) || typeof payment.currency !== "string") return [];
    return [{
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      ...(typeof payment.email === "string" ? { email: payment.email } : typeof payment.customer?.email === "string" ? { email: payment.customer.email } : {}),
      ...(typeof payment.id === "string" || typeof payment.id === "number" ? { transactionId: String(payment.id) } : {}),
      ...(typeof payment.paid_at === "string" ? { paidAt: payment.paid_at } : {}),
      metadata: payment.metadata,
    }];
  });
}

/** Verify Paystack's HMAC-SHA512 signature before parsing a webhook event. */
export function isValidPaystackSignature(rawBody: string | Buffer, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function isPaystackReference(value: unknown): value is string {
  return typeof value === "string" && /^RH-[A-Za-z0-9_-]{16,100}$/.test(value);
}

export function isDonationPaystackReference(value: unknown): value is string {
  return typeof value === "string" && /^RD-[A-Za-z0-9_-]{16,100}$/.test(value);
}
