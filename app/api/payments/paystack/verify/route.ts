import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireAuth } from "@/lib/auth";
import { notifyPaidOrder, resolvePaystackPayment } from "@/lib/paystack-orders";
import { isPaystackReference } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body: unknown = await request.json().catch(() => null);
    const reference = body && typeof body === "object" && "reference" in body ? body.reference : undefined;
    if (!isPaystackReference(reference)) throw new HttpError(400, "Invalid payment reference");
    const result = await resolvePaystackPayment(reference, user.uid);
    if (result.becamePaid) after(() => notifyPaidOrder(result.order));
    return NextResponse.json({ state: result.state, orderNumber: result.order.orderNumber }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
