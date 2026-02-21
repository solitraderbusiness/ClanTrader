import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("icon") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and SVG files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be under 2MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let processed: Buffer;
    if (file.type === "image/svg+xml") {
      // SVG: store as-is
      processed = buffer;
    } else {
      // Raster: resize to 128x128, convert to WebP
      processed = await sharp(buffer)
        .resize(128, 128, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer();
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "badge-icons");
    await mkdir(uploadDir, { recursive: true });

    const ext = file.type === "image/svg+xml" ? "svg" : "webp";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, processed);

    const iconUrl = `/uploads/badge-icons/${filename}`;

    return NextResponse.json({ iconUrl });
  } catch (error) {
    console.error("Badge icon upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
