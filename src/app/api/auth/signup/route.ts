import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";
import { signupSchema } from "@/lib/validators";
import { RESERVED_USERNAMES } from "@/lib/reserved-usernames";
import { trackEvent } from "@/services/referral.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, username, email, password, ref } = parsed.data;

    // Check reserved usernames
    if (RESERVED_USERNAMES.has(username)) {
      return NextResponse.json(
        { error: "This username is reserved" },
        { status: 400 }
      );
    }

    // Check existing email
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Check existing username
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 409 }
      );
    }

    // Lookup referrer by username if ref provided
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

    const passwordHash = hashPassword(password);
    const verifyToken = generateToken();
    const hasSmtp = !!process.env.SMTP_HOST?.trim();

    const newUser = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        name,
        verifyToken,
        ...(referredBy && { referredBy }),
        // Auto-verify when no SMTP is configured (dev mode)
        ...(!hasSmtp && { emailVerified: new Date() }),
      },
    });

    // Track referral signup event
    if (referredBy) {
      trackEvent("SIGNUP", referredBy, newUser.id);
    }

    if (hasSmtp) {
      await sendVerificationEmail(email, verifyToken);
    }

    return NextResponse.json(
      {
        message: hasSmtp
          ? "Account created. Check your email to verify."
          : "Account created. You can now log in.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
