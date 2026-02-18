import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Lock, Crown } from "lucide-react";
import { ReactionBar } from "./ReactionBar";

interface ChannelPostCardProps {
  post: {
    id: string;
    title: string | null;
    content: string;
    images: string[];
    isPremium: boolean;
    locked?: boolean;
    viewCount: number;
    reactions: Record<string, string[]> | null;
    createdAt: string;
    author: { id: string; name: string | null; avatar: string | null };
  };
  clanId: string;
  currentUserId: string | null;
}

export function ChannelPostCard({
  post,
  clanId,
  currentUserId,
}: ChannelPostCardProps) {
  const reactions = (post.reactions || {}) as Record<string, string[]>;

  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Author + timestamp */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={post.author.avatar || undefined}
                alt={post.author.name || ""}
              />
              <AvatarFallback className="text-xs">
                {(post.author.name || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-sm font-medium">
                {post.author.name || "Unknown"}
              </span>
              <span className="ms-2 text-xs text-muted-foreground">
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.isPremium && (
              <Badge variant="default" className="gap-1">
                <Crown className="h-3 w-3" />
                Premium
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        {post.title && (
          <h3 className="text-lg font-semibold">{post.title}</h3>
        )}

        {/* Content */}
        <div className="relative">
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          {post.locked && (
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pt-8">
              <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                <Lock className="h-4 w-4" />
                Premium content — join clan or upgrade to view
              </div>
            </div>
          )}
        </div>

        {/* Images */}
        {post.images.length > 0 && !post.locked && (
          <div
            className={`grid gap-2 ${
              post.images.length === 1
                ? "grid-cols-1"
                : post.images.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2"
            }`}
          >
            {post.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Post image ${i + 1}`}
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: post.images.length === 1 ? 400 : 200 }}
              />
            ))}
          </div>
        )}

        {/* Footer: view count + reactions */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {post.viewCount}
          </div>

          <ReactionBar
            postId={post.id}
            clanId={clanId}
            reactions={reactions}
            currentUserId={currentUserId}
          />

          <Link
            href={`/clans/${clanId}/posts/${post.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View post
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
