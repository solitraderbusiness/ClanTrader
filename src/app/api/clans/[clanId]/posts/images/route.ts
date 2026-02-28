import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { CHANNEL_POST_IMAGES_MAX } from "@/lib/clan-constants";
import { processAndSaveImage } from "@/lib/image-utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Check permission: LEADER or CO_LEADER
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    });

    if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    if (files.length > CHANNEL_POST_IMAGES_MAX) {
      return NextResponse.json(
        { error: `Maximum ${CHANNEL_POST_IMAGES_MAX} images allowed` },
        { status: 400 }
      );
    }

    // Validate all files first
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Only JPEG, PNG, and WebP files are allowed" },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "Each file must be under 5MB" },
          { status: 400 }
        );
      }
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "post-images"
    );
    await mkdir(uploadDir, { recursive: true });

    const imageUrls: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const basename = `${clanId}-${nanoid(8)}`;

      const { fullUrl } = await processAndSaveImage(
        buffer,
        uploadDir,
        basename,
        "/uploads/post-images"
      );

      imageUrls.push(fullUrl);
    }

    return NextResponse.json({ images: imageUrls });
  } catch (error) {
    console.error("Post image upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
