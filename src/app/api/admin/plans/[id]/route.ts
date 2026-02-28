import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePlanSchema } from "@/lib/validators";
import { updatePlan, deletePlan } from "@/services/admin.service";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const plan = await updatePlan(id, parsed.data);
    audit("plan.update", "SubscriptionPlan", id, session.user.id, { changes: parsed.data }, { category: "ADMIN" });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await deletePlan(id);
    audit("plan.delete", "SubscriptionPlan", id, session.user.id, undefined, { category: "ADMIN" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete plan error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
