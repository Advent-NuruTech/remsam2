import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/auth";
import { startPaystackCheckout } from "@/lib/paystack-orders";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const checkout = await startPaystackCheckout(user, await request.json().catch(() => null));
    return NextResponse.json(checkout, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
