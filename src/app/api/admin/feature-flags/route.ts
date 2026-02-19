import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { featureFlagSchema } from "@/lib/validators";
import { getFeatureFlags, createFeatureFlag } from "@/services/admin.service";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const flags = await getFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Get feature flags error:", error);
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
    const parsed = featureFlagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const flag = await createFeatureFlag(parsed.data);
    audit("feature_flag.create", "FeatureFlag", flag.id, session.user.id, { key: flag.key });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("Create feature flag error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
