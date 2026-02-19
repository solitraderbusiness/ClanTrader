import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { planSchema } from "@/lib/validators";
import { getPlans, createPlan } from "@/services/admin.service";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const plans = await getPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Get plans error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = planSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const plan = await createPlan(parsed.data);
    audit("plan.create", "SubscriptionPlan", plan.id, session.user.id);

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("Create plan error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
