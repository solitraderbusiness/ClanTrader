import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cancelPriceAlert, deletePriceAlert } from "@/services/price-alert.service";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alertId } = await params;
  const cancelled = await cancelPriceAlert(alertId, session.user.id);

  if (!cancelled) {
    return NextResponse.json({ error: "Not found or already cancelled", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { alertId } = await params;
  const deleted = await deletePriceAlert(alertId, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
