import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireAuth } from "@/lib/auth";
import { firestore } from "@/lib/firestore";
import { defaultLifeSkillsSettings, isLifeSkillPath, validateLifeSkillsSettings } from "@/lib/life-skills";
import { notifyAdmins, notifySafely, notifyUser } from "@/lib/notifications";

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${label} is required and must be no more than ${maxLength} characters.`);
  }
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Enter your details to continue.");
    const { name, email, phone, path, skillArea, role, message } = body as Record<string, unknown>;
    const cleanedName = requiredText(name, "Name", 120);
    const cleanedEmail = requiredText(email, "Email", 254).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanedEmail)) throw new HttpError(400, "Enter a valid email address.");
    if (phone !== undefined && (typeof phone !== "string" || phone.trim().length > 40)) throw new HttpError(400, "Phone must be no more than 40 characters.");
    const snapshot = await firestore().collection("siteSettings").doc("lifeSkills").get();
    const settings = validateLifeSkillsSettings(snapshot.data()) ?? defaultLifeSkillsSettings;
    if (!isLifeSkillPath(path) || typeof skillArea !== "string" || !settings.skillAreas.includes(skillArea) || typeof role !== "string" || !settings.interestRoles.includes(role)) throw new HttpError(400, "Choose a valid pathway, skill area, and next step.");
    const cleanedMessage = typeof message === "string" ? message.trim() : "";
    if (cleanedMessage.length > 2_000) throw new HttpError(400, "Your message must be no more than 2,000 characters.");

    const identity = request.headers.get("authorization") ? await requireAuth(request) : null;
    const result = await firestore().collection("lifeSkillsInterests").add({
      ...(identity ? { userId: identity.uid } : {}),
      name: cleanedName,
      email: cleanedEmail,
      phone: typeof phone === "string" ? phone.trim() : "",
      path,
      skillArea,
      role,
      message: cleanedMessage,
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    notifySafely(Promise.all([
      notifyAdmins({
        kind: "interest",
        title: "New Life Skills enquiry",
        body: `${cleanedName} is interested in ${skillArea} (${role}).`,
        href: "/rst/admin/life-skills",
      }),
      ...(identity ? [notifyUser(identity.uid, {
        kind: "interest" as const,
        title: "Enquiry received",
        body: "Your Life Skills enquiry has been received.",
        href: "/practical-christianity",
      })] : []),
    ]), `life skills interest ${result.id}`);
    return NextResponse.json({ id: result.id, message: "Your interest has been received." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
