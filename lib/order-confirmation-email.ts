import "server-only";
import { deliverCampaign } from "@/lib/mailing-server";
import type { PublicOrder } from "@/lib/types";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const money = (amount: number) => `KES ${amount.toLocaleString("en-KE")}`;

export async function sendOrderConfirmation(order: PublicOrder) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://remsamhomestead.com";
  const siteUrl = (() => { try { const url = new URL(baseUrl); return url.protocol === "https:" ? url.origin : "https://remsamhomestead.com"; } catch { return "https://remsamhomestead.com"; } })();
  const detailsUrl = `${siteUrl}/order-confirmation/${encodeURIComponent(order.orderNumber)}`;
  const lines = order.items.map((item) => `${item.quantity} × ${item.name}${item.variantName ? ` (${item.variantName})` : ""} — ${money(item.quantity * item.price)}`);
  const rows = lines.map((line) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:15px">${escape(line)}</td></tr>`).join("");
  const result = await deliverCampaign({
    kind: "meeting", subject: `We received your order ${order.orderNumber} | Remsam Homestead`,
    headline: "Thank you for your order", letterTitle: "Your order is on its way to our team",
    preheader: `Order ${order.orderNumber} has been received.`,
    body: "<p>Thank you for shopping with Remsam Homestead. Your Paystack payment has been received.</p><p>We will contact you to confirm delivery details and the separate parcel fee.</p>",
    buttonLabel: "View your order", buttonUrl: detailsUrl, videoUrl: "",
  }, [{ id: order.id, email: order.customer.email, name: order.customer.name }], siteUrl, `order-confirmation:${order.id}`, {
    contentAfterBody: `<div style="margin-top:24px;padding:20px;background:#f4f9f6;border:1px solid #dbe7df;border-radius:10px"><p style="margin:0 0 12px;font-weight:bold;color:#064e3b">ORDER ${escape(order.orderNumber)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><p style="margin:16px 0 4px;font-weight:bold">Products total: ${escape(money(order.total))}</p><p style="margin:0;color:#64748b;font-size:14px">Delivery fee to be confirmed</p></div>`,
    textSuffix: `Order ${order.orderNumber}\n${lines.join("\n")}\nProducts total: ${money(order.total)}\nDelivery fee to be confirmed.`,
  });
  if (result.failures.length) throw new Error(result.failures[0].error);
}
