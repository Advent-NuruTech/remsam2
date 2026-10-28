import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth";
import { firestore } from "@/lib/firestore";
import { serializeOrder, validateStatusBody } from "@/lib/orders";
import { notifySafely, notifyUser } from "@/lib/notifications";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    await requireAdmin(request);
    const { identifier } = await params;
    const reference = firestore().collection("orders").doc(identifier);
    const body: unknown = await request.json().catch(() => null);
    const statuses = validateStatusBody(body);
    const previous = await firestore().runTransaction(async (transaction) => {
      const document = await transaction.get(reference);
      if (!document.exists) throw new HttpError(404, "Order not found");
      const current = document.data() ?? {};
      if (statuses.paymentStatus === "paid" && current.paymentMethod === "paystack") {
        throw new HttpError(400, "Paystack payments can only be marked paid after Paystack verification.");
      }
      if (statuses.orderStatus) {
        const config = await transaction.get(firestore().collection("settings").doc("orderStatuses"));
        const options = config.data()?.statuses ?? ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
        if (!options.includes(statuses.orderStatus)) throw new HttpError(400, "Unknown order status");
      }
      transaction.update(reference, {
        ...(statuses.orderStatus ? { orderStatus: statuses.orderStatus } : {}),
        ...(statuses.paymentStatus ? { paymentStatus: statuses.paymentStatus } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return current as { userId?: unknown; orderNumber?: unknown; orderStatus?: unknown; paymentStatus?: unknown };
    });
    const updated = serializeOrder(await reference.get());
    if (typeof previous.userId === "string") {
      const changes = [
        statuses.orderStatus && statuses.orderStatus !== previous.orderStatus ? `order status is now ${statuses.orderStatus}` : "",
        statuses.paymentStatus && statuses.paymentStatus !== previous.paymentStatus ? `payment status is now ${statuses.paymentStatus}` : "",
      ].filter(Boolean);
      if (changes.length) notifySafely(notifyUser(previous.userId, {
        kind: statuses.paymentStatus ? "payment" : "order",
        title: `Order ${updated.orderNumber} updated`,
        body: `Your ${changes.join(" and ")}.`,
        href: "/account",
      }), `order status ${updated.id}`);
    }
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
