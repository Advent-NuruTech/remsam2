import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { FieldValue, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpError } from "@/lib/auth";
import { sendDonationConfirmation } from "@/lib/donation-confirmation-email";
import { DONATION_QUOTE_TTL_MS, isDonationAmount, isDonationCurrency, MAX_DONATION_AMOUNT, type DonationCurrency } from "@/lib/donation-options";
import { firestore } from "@/lib/firestore";
import { notifyAdmins, notifySafely, notifyUser } from "@/lib/notifications";
import { initializeDonationPaystackPayment, isDonationPaystackReference, listPaystackPayments, verifyPaystackPayment, type PaystackVerification } from "@/lib/paystack";
import { serializeValue } from "@/lib/products";
import { timestamp } from "@/lib/orders";
import type { AppUser, PublicDonation } from "@/lib/types";

type RecordValue = Record<string, unknown>;
type QuoteInput = { currency: DonationCurrency; amount: number };
type DonationInput = QuoteInput & { name?: string; email: string; purpose?: string; quoteId?: string; idempotencyKey: string };

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(record: RecordValue, key: string, max: number) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${key} is required`);
  const result = value.trim();
  if (result.length > max) throw new HttpError(400, `${key} is too long`);
  return result;
}

function optionalString(record: RecordValue, key: string, max: number) {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${key} must be a string`);
  const result = value.trim();
  if (result.length > max) throw new HttpError(400, `${key} is too long`);
  return result || undefined;
}

function donationInput(value: unknown): DonationInput {
  if (!isRecord(value)) throw new HttpError(400, "A JSON donation body is required");
  if (!isDonationCurrency(value.currency)) throw new HttpError(400, "Choose KES or USD");
  if (!isDonationAmount(value.currency, value.amount)) throw new HttpError(400, `Donation amount must be between 1 and ${MAX_DONATION_AMOUNT[value.currency].toLocaleString("en-US")} ${value.currency}`);
  const email = requiredString(value, "email", 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "email is invalid");
  const idempotencyKey = requiredString(value, "idempotencyKey", 100);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new HttpError(400, "Invalid donation attempt");
  }
  const quoteId = optionalString(value, "quoteId", 128);
  if (value.currency === "USD" && !quoteId) throw new HttpError(400, "Get a current KES quote before continuing");
  return { currency: value.currency, amount: value.amount, email, name: optionalString(value, "name", 120), purpose: optionalString(value, "purpose", 300), quoteId, idempotencyKey: idempotencyKey.toLowerCase() };
}

function quoteInput(value: unknown): QuoteInput {
  if (!isRecord(value) || !isDonationCurrency(value.currency) || !isDonationAmount(value.currency, value.amount)) {
    throw new HttpError(400, `Enter a valid USD amount between 1 and ${MAX_DONATION_AMOUNT.USD.toLocaleString("en-US")}`);
  }
  if (value.currency !== "USD") throw new HttpError(400, "KES donations do not need a conversion quote");
  return { currency: value.currency, amount: value.amount };
}

function quoteExpiry(value: unknown) {
  const millis = timestamp(value);
  return millis || 0;
}

async function currentUsdKesRate() {
  let response: Response;
  try {
    response = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new HttpError(503, "A current KES conversion quote is unavailable. Please try again shortly.");
  }
  const data: unknown = await response.json().catch(() => null);
  const rate = isRecord(data) && isRecord(data.rates) ? data.rates.KES : undefined;
  if (!response.ok || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1_000) {
    throw new HttpError(503, "A current KES conversion quote is unavailable. Please try again shortly.");
  }
  return rate;
}

function donationId(idempotencyKey: string) {
  return `paystack-${createHash("sha256").update(idempotencyKey).digest("hex")}`;
}

function asDonation(document: DocumentSnapshot<DocumentData>): PublicDonation {
  return serializeValue({ _id: document.id, id: document.id, ...document.data() }) as PublicDonation;
}

function paymentRecord(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

function compatibleDonationPayment(donation: RecordValue, verification: PaystackVerification) {
  const payment = paymentRecord(donation.paystack);
  if (payment.reference !== verification.reference || payment.amount !== verification.amount || payment.currency !== "KES" || verification.currency !== "KES") return false;
  if (typeof donation.email !== "string" || !verification.email || donation.email.toLowerCase() !== verification.email.toLowerCase()) return false;
  let metadata = verification.metadata;
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata) as unknown; } catch { return false; }
  }
  return isRecord(metadata) && metadata.kind === "donation" && metadata.donationId === donation.id;
}

function failedPaystackStatus(status: string) {
  return ["abandoned", "failed", "reversed"].includes(status);
}

export async function createDonationQuote(body: unknown) {
  const input = quoteInput(body);
  const rate = await currentUsdKesRate();
  const amountKes = Math.round(input.amount * rate);
  if (!Number.isSafeInteger(amountKes) || amountKes < 1) throw new HttpError(503, "The conversion quote is invalid. Please try again.");
  const expiresAt = new Date(Date.now() + DONATION_QUOTE_TTL_MS);
  const quote = await firestore().collection("donationQuotes").add({
    originalCurrency: "USD",
    originalAmount: input.amount,
    conversionRate: rate,
    amountKes,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { quoteId: quote.id, amountKes, conversionRate: rate, expiresAt: expiresAt.toISOString() };
}

export async function startDonationCheckout(body: unknown, identity: AppUser | null) {
  const input = donationInput(body);
  let amountKes = input.amount;
  let conversionRate: number | undefined;

  if (input.currency === "USD") {
    const quote = await firestore().collection("donationQuotes").doc(input.quoteId!).get();
    const data = quote.data() ?? {};
    if (!quote.exists || data.originalCurrency !== "USD" || data.originalAmount !== input.amount || quoteExpiry(data.expiresAt) <= Date.now()) {
      throw new HttpError(409, "This KES quote has expired or changed. Please get a new quote.");
    }
    if (!Number.isSafeInteger(data.amountKes) || typeof data.conversionRate !== "number") throw new HttpError(409, "This KES quote is no longer valid. Please get a new quote.");
    amountKes = data.amountKes;
    conversionRate = data.conversionRate;
  }

  const database = firestore();
  const reference = `RD-${randomUUID().replaceAll("-", "")}`;
  const document = database.collection("donations").doc(donationId(input.idempotencyKey));
  const existing = await document.get();
  if (existing.exists) {
    const data = existing.data() ?? {};
    const payment = paymentRecord(data.paystack);
    if (data.status === "succeeded") return { state: "succeeded" as const, donationId: document.id };
    if (data.status === "pending" && typeof payment.authorizationUrl === "string") return { state: "pending" as const, donationId: document.id, authorizationUrl: payment.authorizationUrl };
    throw new HttpError(409, "This donation attempt is no longer available. Please start a new donation.");
  }

  // An authenticated supporter may still choose not to publish a name.
  const donorName = input.name ?? "Anonymous";
  const donorEmail = input.email;
  await document.create({
    ...(identity ? { userId: identity.uid } : {}),
    name: donorName,
    email: donorEmail,
    ...(input.purpose ? { purpose: input.purpose } : {}),
    amountKes,
    currency: "KES",
    paymentMethod: "paystack",
    status: "pending",
    ...(input.currency === "USD" ? { originalCurrency: "USD", originalAmount: input.amount, conversionRate } : {}),
    paystack: { reference, amount: amountKes * 100, currency: "KES", status: "initializing" },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const payment = await initializeDonationPaystackPayment({
      email: donorEmail,
      amount: amountKes * 100,
      reference,
      donationId: document.id,
      purpose: input.purpose,
      originalCurrency: input.currency,
      originalAmount: input.amount,
      conversionRate,
    });
    await document.update({ "paystack.authorizationUrl": payment.authorizationUrl, "paystack.status": "initialized", "paystack.initializedAt": FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { state: "pending" as const, donationId: document.id, authorizationUrl: payment.authorizationUrl };
  } catch (error) {
    await document.update({ status: "failed", "paystack.status": "initialization_failed", updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    throw error;
  }
}

export async function resolveDonationPayment(reference: string) {
  if (!isDonationPaystackReference(reference)) throw new HttpError(400, "Invalid donation payment reference");
  const database = firestore();
  const matches = await database.collection("donations").where("paystack.reference", "==", reference).limit(1).get();
  const document = matches.docs[0];
  if (!document) throw new HttpError(404, "Donation payment not found");
  const data = document.data() ?? {};
  const verification = await verifyPaystackPayment(reference);
  if (!compatibleDonationPayment({ id: document.id, ...data }, verification)) throw new HttpError(400, "Payment verification did not match this donation");
  if (verification.status === "success") {
    const becameSuccessful = data.status !== "succeeded";
    if (becameSuccessful) await document.ref.update({ status: "succeeded", "paystack.status": "success", "paystack.transactionId": verification.transactionId ?? null, "paystack.paidAt": verification.paidAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    const updated = becameSuccessful ? await document.ref.get() : document;
    if (becameSuccessful) notifySafely(Promise.all([
      notifyAdmins({ kind: "donation", title: "Donation received", body: `${String(data.name ?? "Anonymous")} gave KES ${Number(data.amountKes ?? 0).toLocaleString("en-KE")}.`, href: "/admin/donations" }),
      ...(typeof data.userId === "string" ? [notifyUser(data.userId, { kind: "donation", title: "Thank you for your donation", body: "Your Paystack donation was received successfully.", href: "/donate" })] : []),
      sendDonationConfirmation(asDonation(updated)),
    ]), `donation ${document.id}`);
    return { state: "succeeded" as const, donation: asDonation(updated), becameSuccessful };
  }
  if (failedPaystackStatus(verification.status) && data.status === "pending") {
    await document.ref.update({ status: "failed", "paystack.status": verification.status, updatedAt: FieldValue.serverTimestamp() });
    return { state: "failed" as const, donation: asDonation(await document.ref.get()), becameSuccessful: false };
  }
  return { state: "pending" as const, donation: asDonation(document), becameSuccessful: false };
}

function directDonation(verification: PaystackVerification): PublicDonation | null {
  if (!isDonationPaystackReference(verification.reference) || verification.currency !== "KES") return null;
  let metadata = verification.metadata;
  if (typeof metadata === "string") { try { metadata = JSON.parse(metadata) as unknown; } catch { return null; } }
  if (!isRecord(metadata) || metadata.kind !== "donation") return null;
  const amountKes = verification.amount / 100;
  if (!Number.isSafeInteger(verification.amount) || amountKes <= 0) return null;
  return {
    id: `payment-${verification.reference}`, _id: `payment-${verification.reference}`,
    name: "Anonymous", email: verification.email ?? "", amountKes, currency: "KES", paymentMethod: "paystack",
    status: verification.status === "success" ? "succeeded" : failedPaystackStatus(verification.status) ? "failed" : "pending",
    purpose: typeof metadata.purpose === "string" ? metadata.purpose : undefined,
    originalCurrency: metadata.originalCurrency === "USD" ? "USD" : undefined,
    originalAmount: typeof metadata.originalAmount === "number" ? metadata.originalAmount : undefined,
    conversionRate: typeof metadata.conversionRate === "number" ? metadata.conversionRate : undefined,
    reference: verification.reference, createdAt: verification.paidAt,
    source: "paystack" as const,
  };
}

export async function listDonationsForAdmin() {
  const database = firestore();
  const snapshot = await database.collection("donations").get();
  const local = snapshot.docs.map(asDonation);
  const byReference = new Map<string, PublicDonation>(local.flatMap((donation) => donation.paystack?.reference ? [[donation.paystack.reference, donation] as const] : []));
  let direct: PublicDonation[] = [];
  let paymentRecordsChecked = false;
  try {
    const payments = await listPaystackPayments();
    paymentRecordsChecked = true;
    for (const payment of payments) {
      const remote = directDonation(payment);
      if (!remote) continue;
      const localDonation = byReference.get(payment.reference);
      if (localDonation) {
        if (localDonation.status === "pending" && payment.status === "success") await resolveDonationPayment(payment.reference).catch(() => undefined);
      } else direct.push(remote);
    }
  } catch (error) {
    console.error("Direct donation payment reconciliation failed", error);
  }
  const refreshed = paymentRecordsChecked ? (await database.collection("donations").get()).docs.map(asDonation) : local;
  const donations = [...refreshed, ...direct].sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt));
  return { donations, totalSuccessfulKes: donations.filter((donation) => donation.status === "succeeded").reduce((sum, donation) => sum + donation.amountKes, 0), paymentRecordsChecked };
}
