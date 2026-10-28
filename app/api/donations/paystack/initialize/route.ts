import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/auth";
import { startDonationCheckout } from "@/lib/donation-payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const identity = request.headers.get("authorization") ? await requireAuth(request) : null;
    return NextResponse.json(await startDonationCheckout(await request.json().catch(() => null), identity), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
