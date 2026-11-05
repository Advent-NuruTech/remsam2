import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireAuth } from "@/lib/auth";
import { firestore } from "@/lib/firestore";
import { notifyAdmins, notifySafely, notifyUser } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Missing required fields");
    }
    const { name, email, subject, message } = body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
      throw new HttpError(400, "A valid name is required");
    }
    if (
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      email.trim().length > 254
    ) {
      throw new HttpError(400, "A valid email is required");
    }
    if (typeof message !== "string" || !message.trim() || message.trim().length > 10_000) {
      throw new HttpError(400, "A message of up to 10,000 characters is required");
    }
    if (subject !== undefined && (typeof subject !== "string" || subject.trim().length > 200)) {
      throw new HttpError(400, "Subject must be at most 200 characters");
    }

    const identity = request.headers.get("authorization") ? await requireAuth(request) : null;
    const result = await firestore().collection("contacts").add({
      ...(identity ? { userId: identity.uid } : {}),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: typeof subject === "string" ? subject.trim() : "",
      message: message.trim(),
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    notifySafely(Promise.all([
      notifyAdmins({
        kind: "contact",
        title: "New contact message",
        body: `${name.trim()} sent${typeof subject === "string" && subject.trim() ? `: ${subject.trim()}` : " a message"}.`,
        href: "/rst/admin/dashboard",
      }),
      ...(identity ? [notifyUser(identity.uid, {
        kind: "contact" as const,
        title: "Message received",
        body: "We received your message and will get back to you soon.",
        href: "/contact",
      })] : []),
    ]), `contact ${result.id}`);

    return NextResponse.json(
      { id: result.id, message: "Email sent successfully" },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
