import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth";
import { createDonationQuote } from "@/lib/donation-payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await createDonationQuote(await request.json().catch(() => null)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
