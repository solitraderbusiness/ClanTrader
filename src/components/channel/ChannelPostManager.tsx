"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreatePostForm } from "./CreatePostForm";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Crown } from "lucide-react";

interface PostData {
  id: string;
  title: string | null;
  content: string;
  isPremium: boolean;
  viewCount: number;
  createdAt: string;
}

interface ChannelPostManagerProps {
  clanId: string;
}

export function ChannelPostManager({ clanId }: ChannelPostManagerProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/clans/${clanId}/posts?page=1`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [clanId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/clans/${clanId}/posts/${postId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Post deleted");
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete post");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading posts...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Channel Posts</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="me-1 h-4 w-4" />
          New Post
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4">
          <CreatePostForm
            clanId={clanId}
            onSuccess={() => {
              setShowForm(false);
              fetchPosts();
            }}
          />
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No channel posts yet. Create one to broadcast to your followers.
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {post.title || post.content.slice(0, 50)}
                  </span>
                  {post.isPremium && (
                    <Badge variant="default" className="gap-1">
                      <Crown className="h-3 w-3" />
                      Premium
                    </Badge>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {post.viewCount}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(post.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
