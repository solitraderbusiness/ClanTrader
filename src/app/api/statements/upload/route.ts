import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { parseStatement, StatementParseError } from "@/services/statement-parser";

const ALLOWED_EXTENSIONS = [".html", ".htm"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("statement") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Only HTML/HTM files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Save file first
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "statements",
      session.user.id
    );
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}_${safeFilename}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Parse the statement
    let metrics;
    try {
      metrics = parseStatement(buffer);
    } catch (err) {
      if (err instanceof StatementParseError) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      throw err;
    }

    const fileUrl = `/uploads/statements/${session.user.id}/${filename}`;

    // Create database record
    const statement = await db.tradingStatement.create({
      data: {
        userId: session.user.id,
        filePath: fileUrl,
        originalFilename: file.name,
        extractedMetrics: JSON.parse(JSON.stringify(metrics)),
      },
    });

    return NextResponse.json({
      id: statement.id,
      metrics,
    });
  } catch (error) {
    console.error("Statement upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
