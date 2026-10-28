import "server-only";

import { deliverCampaign } from "@/lib/mailing-server";
import type { PublicDonation } from "@/lib/types";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const money = (amount: number) => `KES ${amount.toLocaleString("en-KE")}`;

function siteUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://remsamhomestead.com";
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" ? url.origin : "https://remsamhomestead.com";
  } catch {
    return "https://remsamhomestead.com";
  }
}

/** Sends one branded Paystack payment receipt after a donation is confirmed. */
export async function sendDonationConfirmation(donation: PublicDonation) {
  const email = donation.email?.trim().toLowerCase();
  if (!email) return;

  const reference = donation.paystack?.reference || donation.reference || donation.id;
  const selectedAmount = donation.originalCurrency === "USD" && typeof donation.originalAmount === "number"
    ? `<p style="margin:12px 0 0;color:#64748b;font-size:14px">Your selected gift: ${escape(`USD ${donation.originalAmount.toLocaleString("en-US")}`)}. Paystack settled the payment in KES.</p>`
    : "";
  const purpose = donation.purpose
    ? `<p style="margin:12px 0 0;color:#334155;font-size:14px"><strong>Purpose:</strong> ${escape(donation.purpose)}</p>`
    : "";
  const receipt = `<div style="margin-top:24px;padding:20px;background:#f4f9f6;border:1px solid #dbe7df;border-radius:10px"><p style="margin:0 0 14px;font-weight:800;letter-spacing:1px;color:#064e3b;font-size:13px">DONATION RECEIPT</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding:9px 0;border-bottom:1px solid #dbe7df;color:#64748b;font-size:14px">Amount received</td><td align="right" style="padding:9px 0;border-bottom:1px solid #dbe7df;color:#172126;font-size:16px;font-weight:800">${escape(money(donation.amountKes))}</td></tr><tr><td style="padding:9px 0;border-bottom:1px solid #dbe7df;color:#64748b;font-size:14px">Payment method</td><td align="right" style="padding:9px 0;border-bottom:1px solid #dbe7df;color:#172126;font-size:14px">Paystack</td></tr><tr><td style="padding:9px 0;color:#64748b;font-size:14px">Receipt reference</td><td align="right" style="padding:9px 0;color:#172126;font-size:13px;font-family:monospace">${escape(reference)}</td></tr></table>${selectedAmount}${purpose}</div>`;
  const result = await deliverCampaign({
    kind: "meeting",
    subject: "Thank you for your donation | Remsam Homestead",
    headline: "Thank you for your generous gift",
    letterTitle: "Your donation receipt",
    preheader: `Your Paystack donation of ${money(donation.amountKes)} has been received.`,
    body: "<p>Thank you for supporting Remsam Homestead. Your donation has been received safely, and your payment receipt is included below.</p><p>Your generosity helps us continue our work in faith, family, and farming.</p>",
    buttonLabel: "Visit Remsam Homestead",
    buttonUrl: siteUrl(),
    videoUrl: "",
  }, [{ id: donation.id, email, name: donation.name }], siteUrl(), `donation-confirmation:${donation.id}`, {
    contentAfterBody: receipt,
    textSuffix: `Donation receipt\nAmount received: ${money(donation.amountKes)}\nPayment method: Paystack\nReceipt reference: ${reference}${donation.originalCurrency === "USD" && typeof donation.originalAmount === "number" ? `\nYour selected gift: USD ${donation.originalAmount.toLocaleString("en-US")}. Paystack settled the payment in KES.` : ""}${donation.purpose ? `\nPurpose: ${donation.purpose}` : ""}`,
  });
  if (result.failures.length) throw new Error(result.failures[0].error);
}
