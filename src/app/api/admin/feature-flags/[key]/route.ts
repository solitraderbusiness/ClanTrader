import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateFeatureFlagSchema } from "@/lib/validators";
import { updateFeatureFlag, deleteFeatureFlag } from "@/services/admin.service";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { key } = await params;
    const body = await request.json();
    const parsed = updateFeatureFlagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const flag = await updateFeatureFlag(key, parsed.data);
    audit("feature_flag.update", "FeatureFlag", flag.id, session.user.id, {
      key,
      changes: parsed.data,
    });

    return NextResponse.json({ flag });
  } catch (error) {
    console.error("Update feature flag error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { key } = await params;
    await deleteFeatureFlag(key);
    audit("feature_flag.delete", "FeatureFlag", key, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete feature flag error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
