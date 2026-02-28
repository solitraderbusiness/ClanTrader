import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePaywallRuleSchema } from "@/lib/validators";
import { updatePaywallRule, deletePaywallRule } from "@/services/admin.service";
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
    const parsed = updatePaywallRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rule = await updatePaywallRule(id, {
      ...parsed.data,
      freePreview: parsed.data.freePreview as Record<string, boolean> | undefined,
    });
    audit("paywall_rule.update", "PaywallRule", id, session.user.id, { changes: parsed.data }, { category: "ADMIN" });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Update paywall rule error:", error);
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
    await deletePaywallRule(id);
    audit("paywall_rule.delete", "PaywallRule", id, session.user.id, undefined, { category: "ADMIN" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete paywall rule error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
