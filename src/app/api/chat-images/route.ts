import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { CHAT_IMAGES_MAX } from "@/lib/chat-constants";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    if (files.length > CHAT_IMAGES_MAX) {
      return NextResponse.json(
        { error: `Maximum ${CHAT_IMAGES_MAX} images allowed` },
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
      "chat-images"
    );
    await mkdir(uploadDir, { recursive: true });

    const imageUrls: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const processed = await sharp(buffer)
        .resize(1200, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const filename = `${session.user.id}-${nanoid(8)}.webp`;
      const filepath = path.join(uploadDir, filename);
      await writeFile(filepath, processed);

      imageUrls.push(`/uploads/chat-images/${filename}`);
    }

    return NextResponse.json({ images: imageUrls });
  } catch (error) {
    console.error("Chat image upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
