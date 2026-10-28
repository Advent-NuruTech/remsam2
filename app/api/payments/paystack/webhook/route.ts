import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth";
import { resolveDonationPayment } from "@/lib/donation-payments";
import { notifyPaidOrder, resolvePaystackPayment } from "@/lib/paystack-orders";
import { isDonationPaystackReference, isPaystackReference, isValidPaystackSignature } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    if (!isValidPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
    const event: unknown = JSON.parse(rawBody.toString("utf8"));
    const type = event && typeof event === "object" && "event" in event ? event.event : undefined;
    const data = event && typeof event === "object" && "data" in event ? event.data : undefined;
    const reference = data && typeof data === "object" && "reference" in data ? data.reference : undefined;
    // We deliberately verify with Paystack again; a signed webhook alone is not
    // enough to establish the expected order amount and currency.
    if (type === "charge.success") {
      if (isPaystackReference(reference)) {
        const result = await resolvePaystackPayment(reference);
        if (result.becamePaid) after(() => notifyPaidOrder(result.order));
      } else if (isDonationPaystackReference(reference)) {
        await resolveDonationPayment(reference);
      }
    }
    return NextResponse.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Paystack webhook processing failed", error);
    return errorResponse(error);
  }
}
