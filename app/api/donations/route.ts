import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // The former manual endpoint could create a donation without charging it.
    // Keep its URL from silently accepting requests while clients migrate.
    throw new HttpError(410, "Donations must be started through secure Paystack checkout.");
  } catch (error) {
    return errorResponse(error);
  }
}
