import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth-utils";
import { sendVerificationEmail } from "@/lib/email";
import { addEmailSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = addEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Check user doesn't already have email
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (user?.email) {
      return NextResponse.json(
        { error: "Email already set on this account" },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "This email is already in use" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const verifyToken = generateToken();
    const hasSmtp = !!process.env.SMTP_HOST?.trim();

    await db.user.update({
      where: { id: session.user.id },
      data: {
        email,
        passwordHash,
        verifyToken,
        ...(!hasSmtp && { emailVerified: new Date() }),
      },
    });

    if (hasSmtp) {
      await sendVerificationEmail(email, verifyToken);
    }

    return NextResponse.json({
      message: hasSmtp
        ? "Email added. Check your inbox to verify."
        : "Email and password added successfully.",
    });
  } catch (error) {
    console.error("Add email error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
