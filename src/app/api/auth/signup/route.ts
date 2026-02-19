import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";
import { signupSchema } from "@/lib/validators";

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

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const verifyToken = generateToken();
    const hasSmtp = !!process.env.SMTP_HOST?.trim();

    await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        verifyToken,
        // Auto-verify when no SMTP is configured (dev mode)
        ...(!hasSmtp && { emailVerified: new Date() }),
      },
    });

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
