import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { addPhoneSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = addPhoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // Validate phone-verify-token from Redis
    const tokenKey = `phone-verify-token:${token}`;
    const phone = await redis.get(tokenKey);

    if (!phone) {
      return NextResponse.json(
        { error: "Token expired or invalid. Please verify your phone again." },
        { status: 400 }
      );
    }

    // Delete token (one-time use)
    await redis.del(tokenKey);

    // Check phone uniqueness
    const existingPhone = await db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json(
        { error: "This phone number is already registered to another account" },
        { status: 409 }
      );
    }

    // Update user with phone
    await db.user.update({
      where: { id: session.user.id },
      data: {
        phone,
        phoneVerified: new Date(),
      },
    });

    return NextResponse.json({
      message: "Phone number added successfully.",
    });
  } catch (error) {
    console.error("Add phone error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
