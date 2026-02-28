import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { log } from "@/lib/audit";
import { generateToken } from "@/lib/auth-utils";
import { verifyOtpSchema } from "@/lib/validators";

const MAX_ATTEMPTS = 5;
const TOKEN_TTL = 600; // 10 minutes

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { phone, code, mode } = parsed.data;

    // Get OTP from Redis
    const otpKey = `otp:${phone}`;
    const otpData = await redis.get(otpKey);

    if (!otpData) {
      return NextResponse.json(
        { error: "OTP expired or not found. Request a new one." },
        { status: 400 }
      );
    }

    const otp = JSON.parse(otpData) as { code: string; attempts: number };

    // Check attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      await redis.del(otpKey);
      log("auth.otp_max_attempts", "WARN", "AUTH", { phone });
      return NextResponse.json(
        { error: "Too many failed attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    // Verify code
    if (otp.code !== code) {
      otp.attempts += 1;
      await redis.set(otpKey, JSON.stringify(otp), "KEEPTTL");
      log("auth.otp_invalid", "WARN", "AUTH", { phone, attempts: otp.attempts });
      return NextResponse.json(
        { error: "Invalid code. Try again." },
        { status: 400 }
      );
    }

    // OTP is correct — delete it
    await redis.del(otpKey);

    const token = generateToken();

    // Mode: add-phone (existing user adding phone to account)
    if (mode === "add-phone") {
      await redis.set(`phone-verify-token:${token}`, phone, "EX", TOKEN_TTL);
      log("auth.otp_verified", "INFO", "AUTH", { phone, mode: "add-phone" });
      return NextResponse.json({ verified: true, token, mode: "add-phone" });
    }

    // Check if phone exists in DB
    const existingUser = await db.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (existingUser) {
      // Existing user — generate login token
      await redis.set(`login-token:${token}`, existingUser.id, "EX", TOKEN_TTL);
      log("auth.otp_verified", "INFO", "AUTH", { phone, isNewUser: false }, existingUser.id);
      return NextResponse.json({ verified: true, isNewUser: false, token });
    }

    // New user — generate signup token
    await redis.set(`signup-token:${token}`, phone, "EX", TOKEN_TTL);
    log("auth.otp_verified", "INFO", "AUTH", { phone, isNewUser: true });
    return NextResponse.json({ verified: true, isNewUser: true, token });
  } catch (error) {
    log("auth.verify_otp_error", "ERROR", "AUTH", { error: String(error) });
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
