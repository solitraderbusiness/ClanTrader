import { NextResponse } from "next/server";
import crypto from "crypto";
import { redis } from "@/lib/redis";
import { log } from "@/lib/audit";
import { sendOtp } from "@/services/sms.service";
import { sendOtpSchema } from "@/lib/validators";

const OTP_TTL = 300; // 5 minutes
const RATE_LIMIT_TTL = 600; // 10 minutes
const RATE_LIMIT_MAX = 3;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;

    // Rate limit check
    const rateLimitKey = `otp-limit:${phone}`;
    const currentCount = await redis.get(rateLimitKey);
    if (currentCount && parseInt(currentCount) >= RATE_LIMIT_MAX) {
      log("auth.otp_rate_limited", "WARN", "AUTH", { phone });
      return NextResponse.json(
        { error: "Too many OTP requests. Try again later." },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const code = String(crypto.randomInt(100000, 999999));

    // Store OTP in Redis
    const otpKey = `otp:${phone}`;
    await redis.set(otpKey, JSON.stringify({ code, attempts: 0 }), "EX", OTP_TTL);

    // Increment rate limit
    const newCount = await redis.incr(rateLimitKey);
    if (newCount === 1) {
      await redis.expire(rateLimitKey, RATE_LIMIT_TTL);
    }

    // Send SMS
    await sendOtp(phone, code);

    log("auth.otp_sent", "INFO", "AUTH", { phone });

    return NextResponse.json({ sent: true });
  } catch (error) {
    log("auth.otp_send_error", "ERROR", "AUTH", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
