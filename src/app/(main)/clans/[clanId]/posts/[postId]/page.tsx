import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPost, ChannelServiceError } from "@/services/channel.service";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReactionBar } from "@/components/channel/ReactionBar";
import Link from "next/link";
import { ArrowLeft, Eye, Crown, Lock } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clanId: string; postId: string }>;
}) {
  const { postId } = await params;
  try {
    const post = await getPost(postId);
    return { title: post.title || "Post" };
  } catch {
    return { title: "Post" };
  }
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ clanId: string; postId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { clanId, postId } = await params;

  let post;
  try {
    post = await getPost(postId);
  } catch (e) {
    if (e instanceof ChannelServiceError && e.code === "NOT_FOUND") {
      notFound();
    }
    notFound();
  }

  // Check premium access
  let canView = true;
  if (post.isPremium) {
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    });
    canView = !!membership || (session.user.isPro ?? false);
  }

  const reactions = (post.reactions || {}) as Record<string, string[]>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/clans/${clanId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Back to {post.clan.name}
        </span>
      </div>

      {/* Author + meta */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={post.author.avatar || undefined}
              alt={post.author.name || ""}
            />
            <AvatarFallback>
              {(post.author.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="font-medium">
              {post.author.name || "Unknown"}
            </span>
            <p className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()} &middot;{" "}
              <Eye className="me-0.5 inline h-3 w-3" />
              {post.viewCount} views
            </p>
          </div>
        </div>
        {post.isPremium && (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        )}
      </div>

      {/* Title */}
      {post.title && (
        <h1 className="text-2xl font-bold">{post.title}</h1>
      )}

      {/* Content */}
      {canView ? (
        <>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {post.content}
          </div>

          {/* Images */}
          {post.images.length > 0 && (
            <div className="space-y-3">
              {post.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Post image ${i + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">Premium Content</h2>
            <p className="text-sm text-muted-foreground">
              Join this clan or upgrade to Pro to view this post.
            </p>
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="border-t pt-4">
        <ReactionBar
          postId={postId}
          clanId={clanId}
          reactions={reactions}
          currentUserId={session.user.id}
        />
      </div>

      {/* Placeholder */}
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Comments coming soon
      </div>
    </div>
  );
}
