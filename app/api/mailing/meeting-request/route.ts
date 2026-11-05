import { createHash, randomUUID } from "node:crypto";
import { getMailDb, FieldValue, sendMeetingRequestWelcome } from "@/lib/mailing-server";
import { notifyAdmins, notifySafely } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Complete the form with a valid name, email, and message." }, { status: 400 });
    const requestBody = body as { name?: unknown; email?: unknown; phone?: unknown; message?: unknown };
    const name = typeof requestBody.name === "string" ? requestBody.name.trim() : "";
    const email = typeof requestBody.email === "string" ? requestBody.email.trim().toLowerCase() : "";
    const phone = typeof requestBody.phone === "string" ? requestBody.phone.trim() : "";
    const message = typeof requestBody.message === "string" ? requestBody.message.trim() : "";
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        phone.length > 40 || !message || message.length > 4000) {
      return Response.json({ error: "Complete the form with a valid name, email, and message." }, { status: 400 });
    }
    const mailDb = getMailDb();
    const memberId = createHash("sha256").update(email).digest("hex");
    const member = mailDb.collection("onlineMeetingMembers").doc(memberId);
    const contact = mailDb.collection("contacts").doc(randomUUID());
    const now = FieldValue.serverTimestamp();
    const result = await mailDb.runTransaction(async (transaction) => {
      const prior = await transaction.get(member);
      transaction.set(contact, { category: "meeting-link", name, email, phone, message, createdAt: now });
      if (!prior.exists) {
        transaction.create(member, { email, name, status: "pending", source: "meeting-request", createdAt: now });
        return "pending";
      }
      transaction.update(member, { name });
      return prior.get("status") === "verified" ? "verified" : "pending";
    });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      `https://${process.env.VERCEL_URL ?? new URL(request.url).host}`;
    notifySafely(notifyAdmins({
      kind: "contact",
      title: "New meeting-link request",
      body: `${name} requested an online meeting link.`,
      href: "/rst/admin/mailing",
    }), `meeting request ${contact.id}`);
    try {
      const delivery = await sendMeetingRequestWelcome({ id: memberId, email, name }, baseUrl);
      if (delivery.failures.length) {
        console.error("Meeting request confirmation email delivery failed", {
          memberId,
          error: delivery.failures[0].error,
        });
        return Response.json({
          received: true,
          status: result,
          confirmationEmailSent: false,
          confirmationEmailError: "Your request was received, but we could not send the confirmation email. We will still follow up with the meeting link soon.",
        }, { status: 201 });
      }
      return Response.json({ received: true, status: result, confirmationEmailSent: true }, { status: 201 });
    } catch (error) {
      console.error("Meeting request confirmation email failed", { memberId, error });
      return Response.json({
        received: true,
        status: result,
        confirmationEmailSent: false,
        confirmationEmailError: "Your request was received, but we could not send the confirmation email. We will still follow up with the meeting link soon.",
      }, { status: 201 });
    }
  } catch (error) {
    console.error("Meeting link request failed", error);
    return Response.json({ error: "Your request could not be sent. Please try again." }, { status: 500 });
  }
}
