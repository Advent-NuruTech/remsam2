import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError } from "@/lib/auth";
import { resolveDonationPayment } from "@/lib/donation-payments";
import { isDonationPaystackReference } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const reference = body && typeof body === "object" && "reference" in body ? body.reference : undefined;
    if (!isDonationPaystackReference(reference)) throw new HttpError(400, "Invalid donation payment reference");
    const result = await resolveDonationPayment(reference);
    return NextResponse.json({ state: result.state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
