import { NextResponse } from "next/server";
import { eaRegisterSchema } from "@/lib/validators";
import { registerEaUser } from "@/services/ea.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = eaRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await registerEaUser(parsed.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    if (
      message === "Username already taken" ||
      message === "This username is reserved" ||
      message === "This trading account is already connected by another user"
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
