import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { paywallRuleSchema } from "@/lib/validators";
import { getPaywallRules, createPaywallRule } from "@/services/admin.service";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const rules = await getPaywallRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Get paywall rules error:", error);
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
    const parsed = paywallRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rule = await createPaywallRule({
      ...parsed.data,
      freePreview: parsed.data.freePreview as Record<string, boolean> | undefined,
    });
    audit("paywall_rule.create", "PaywallRule", rule.id, session.user.id, undefined, { category: "ADMIN" });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Create paywall rule error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
