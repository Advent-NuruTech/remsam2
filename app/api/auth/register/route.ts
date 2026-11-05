import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { errorResponse, HttpError } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { firestore } from "@/lib/firestore";
import type { AppUser } from "@/lib/types";
import { notifyAdmins, notifySafely, notifyUser } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const tokenUser = await requireAuthWithoutProfile(request);
    const body: unknown = await request.json();
    const submittedName =
      typeof body === "object" && body !== null && "name" in body && typeof body.name === "string"
        ? body.name.trim()
        : "";
    const isAdminSignup =
      typeof body === "object" && body !== null && "signupCode" in body;
    const submittedSignupCode =
      isAdminSignup && typeof body.signupCode === "string" ? body.signupCode : null;

    if (!submittedName || submittedName.length > 120) {
      return NextResponse.json({ message: "A name of up to 120 characters is required" }, { status: 400 });
    }
    if (!tokenUser.email) {
      return NextResponse.json({ message: "Firebase user has no email address" }, { status: 400 });
    }

    let role: AppUser["role"] = "user";
    if (isAdminSignup) {
      const configuredSignupCode = process.env.SIGN_UP_CODE;
      if (!configuredSignupCode) {
        throw new HttpError(503, "Admin signup is not configured");
      }
      if (
        submittedSignupCode === null ||
        !securelyMatches(submittedSignupCode, configuredSignupCode)
      ) {
        throw new HttpError(403, "Invalid admin signup code");
      }
      role = "admin";
    }

    const userRef = firestore().collection("users").doc(tokenUser.uid);
    const created = await firestore().runTransaction(async (transaction) => {
      const existing = await transaction.get(userRef);
      if (existing.exists) {
        if (isAdminSignup && existing.data()?.role !== "admin") {
          throw new HttpError(409, "A non-admin profile already exists for this account");
        }
        return false;
      }

      transaction.set(userRef, {
        name: submittedName,
        email: tokenUser.email,
        role,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    const profile = await userRef.get();
    const data = profile.data();
    if (
      !data ||
      typeof data.name !== "string" ||
      typeof data.email !== "string" ||
      (data.role !== "user" && data.role !== "admin")
    ) {
      throw new Error("User profile has an invalid shape");
    }
    const response: AppUser = {
      uid: tokenUser.uid,
      name: data.name,
      email: data.email,
      role: data.role,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
    if (created) {
      notifySafely(Promise.all([
        notifyUser(tokenUser.uid, {
          kind: "account",
          title: role === "admin" ? "Admin account ready" : "Welcome to RemSam Homestead",
          body: role === "admin" ? "Your administrator workspace is ready." : "Your account is ready. Order and account updates will appear here.",
          href: role === "admin" ? "/rst/admin/dashboard" : "/account",
        }),
        ...(role === "user" ? [notifyAdmins({
          kind: "account" as const,
          title: "New customer account",
          body: `${data.name} created an account.`,
          href: "/rst/admin/dashboard",
        })] : []),
      ]), `registration ${tokenUser.uid}`);
    }
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function securelyMatches(submitted: string, configured: string) {
  const submittedHash = createHash("sha256").update(submitted, "utf8").digest();
  const configuredHash = createHash("sha256").update(configured, "utf8").digest();
  return timingSafeEqual(submittedHash, configuredHash);
}

async function requireAuthWithoutProfile(request: NextRequest) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Not authorized, no token");
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Not authorized, token failed");
  }
}
