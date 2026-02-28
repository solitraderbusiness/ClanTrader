import { NextResponse } from "next/server";
import { eaLoginSchema } from "@/lib/validators";
import { loginEaUser } from "@/services/ea.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = eaLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await loginEaUser(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    if (message === "Invalid username or password") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message === "This trading account is already connected by another user") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
