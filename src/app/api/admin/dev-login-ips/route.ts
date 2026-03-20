import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addSchema = z.object({
  ip: z.string().min(7).max(45),
  label: z.string().max(100).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ips = await db.devLoginIp.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ips });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await db.devLoginIp.findUnique({
    where: { ip: parsed.data.ip },
  });
  if (existing) {
    return NextResponse.json({ error: "IP already exists" }, { status: 409 });
  }

  const entry = await db.devLoginIp.create({
    data: { ip: parsed.data.ip, label: parsed.data.label || null },
  });

  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.devLoginIp.delete({ where: { id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}
