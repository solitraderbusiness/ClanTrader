import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth-utils";
import { phoneSignupSchema } from "@/lib/validators";
import { RESERVED_USERNAMES } from "@/lib/reserved-usernames";
import { trackEvent } from "@/services/referral.service";

const TOKEN_TTL = 600; // 10 minutes

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = phoneSignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, name, username, ref } = parsed.data;

    // Validate signup token from Redis
    const signupTokenKey = `signup-token:${token}`;
    const phone = await redis.get(signupTokenKey);

    if (!phone) {
      return NextResponse.json(
        { error: "Signup token expired or invalid. Please verify your phone again." },
        { status: 400 }
      );
    }

    // Delete signup token (one-time use)
    await redis.del(signupTokenKey);

    // Check reserved usernames
    if (RESERVED_USERNAMES.has(username)) {
      return NextResponse.json(
        { error: "This username is reserved" },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 409 }
      );
    }

    // Check phone uniqueness (race condition guard)
    const existingPhone = await db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json(
        { error: "This phone number is already registered" },
        { status: 409 }
      );
    }

    // Lookup referrer
    let referredBy: string | undefined;
    if (ref) {
      const referrer = await db.user.findUnique({
        where: { username: ref },
        select: { id: true },
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // Create user (phone-only, no email/password)
    const newUser = await db.user.create({
      data: {
        phone,
        phoneVerified: new Date(),
        name,
        username,
        ...(referredBy && { referredBy }),
      },
    });

    // Track referral
    if (referredBy) {
      trackEvent("SIGNUP", referredBy, newUser.id);
    }

    // Generate login token
    const loginToken = generateToken();
    await redis.set(`login-token:${loginToken}`, newUser.id, "EX", TOKEN_TTL);

    return NextResponse.json({ loginToken }, { status: 201 });
  } catch (error) {
    console.error("Phone signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
