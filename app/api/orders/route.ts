import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/auth";
import { firestore } from "@/lib/firestore";
import { serializeOrder, timestamp } from "@/lib/orders";

/**
 * Orders are deliberately created only by the Paystack initialization route.
 * Keeping this legacy endpoint read-only prevents unpaid inventory reservations.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { message: "Orders must be started through secure Paystack checkout." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const status = request.nextUrl.searchParams.get("status")?.trim() ?? "";
    const paymentStatus = request.nextUrl.searchParams.get("paymentStatus")?.trim() ?? "";
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
    const snapshot = await firestore().collection("orders").get();
    const matching = snapshot.docs
      .filter((document) => !status || document.data().orderStatus === status)
      .filter((document) => !paymentStatus || document.data().paymentStatus === paymentStatus)
      .sort((left, right) => timestamp(right.data().createdAt) - timestamp(left.data().createdAt));
    const total = matching.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const orders = matching.slice((currentPage - 1) * limit, currentPage * limit).map(serializeOrder);
    return NextResponse.json({ orders, totalPages, currentPage, total });
  } catch (error) {
    return errorResponse(error);
  }
}
