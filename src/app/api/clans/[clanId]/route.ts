import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateClanSchema, clanSettingsSchema } from "@/lib/validators";
import {
  getClan,
  updateClan,
  deleteClan,
  ClanServiceError,
} from "@/services/clan.service";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const { clanId } = await params;
    const clan = await getClan(clanId);
    return NextResponse.json(clan);
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    const body = await request.json();

    // Extract settings separately
    const { settings: settingsInput, ...clanData } = body;
    const parsed = updateClanSchema.safeParse(clanData);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clan = await updateClan(clanId, session.user.id, parsed.data);

    // Handle settings update if provided
    if (settingsInput) {
      const settingsParsed = clanSettingsSchema.safeParse(settingsInput);
      if (settingsParsed.success) {
        const existingSettings = (clan.settings as Record<string, unknown>) || {};
        await db.clan.update({
          where: { id: clanId },
          data: {
            settings: { ...existingSettings, ...settingsParsed.data },
          },
        });
      }
    }

    const updatedClan = await getClan(clanId);
    return NextResponse.json(updatedClan);
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Update clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    await deleteClan(clanId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Delete clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
