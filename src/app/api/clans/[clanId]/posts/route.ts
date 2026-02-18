import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChannelPostSchema } from "@/lib/validators";
import {
  createPost,
  getChannelPosts,
  ChannelServiceError,
} from "@/services/channel.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    const { clanId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");

    const result = await getChannelPosts(clanId, {
      page,
      userId: session?.user?.id || null,
      isPro: session?.user?.isPro ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChannelServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get channel posts error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const parsed = createChannelPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const post = await createPost(clanId, session.user.id, parsed.data);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    if (error instanceof ChannelServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create post error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
