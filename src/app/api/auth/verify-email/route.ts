import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { generateToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        verifyToken: token,
        verifyTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verifyToken: null,
        verifyTokenExpiry: null,
      },
    });

    return NextResponse.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const limited = await rateLimit(`auth:verify-resend:${getClientIp(request)}`, "AUTH_STRICT");
    if (limited) return limited;

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required", code: "MISSING_EMAIL" },
        { status: 400 }
      );
    }

    // Rate limit: 1 resend per 60 seconds
    const rateLimitKey = `verify-resend:${email.toLowerCase()}`;
    const existing = await redis.get(rateLimitKey);
    if (existing) {
      return NextResponse.json(
        { error: "Please wait before requesting another email", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerified: true },
    });

    // Don't reveal whether user exists — always return success
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "If the email exists, a verification link has been sent." });
    }

    const newToken = generateToken();
    await db.user.update({
      where: { id: user.id },
      data: {
        verifyToken: newToken,
        verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendVerificationEmail(user.email!, newToken);

    // Set rate limit (60 seconds)
    await redis.set(rateLimitKey, "1", "EX", 60);

    return NextResponse.json({ message: "Verification email sent." });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
