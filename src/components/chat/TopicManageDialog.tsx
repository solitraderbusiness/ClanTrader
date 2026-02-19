"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TOPIC_NAME_MAX, TOPIC_NAME_MIN, TOPIC_DESCRIPTION_MAX } from "@/lib/chat-constants";

interface TopicManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
  onTopicCreated: (topic: { id: string; clanId: string; name: string; description: string | null; isDefault: boolean; status: string; sortOrder: number }) => void;
}

export function TopicManageDialog({
  open,
  onOpenChange,
  clanId,
  onTopicCreated,
}: TopicManageDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < TOPIC_NAME_MIN) {
      toast.error(`Topic name must be at least ${TOPIC_NAME_MIN} characters`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create topic");
        return;
      }

      const data = await res.json();
      onTopicCreated(data.topic);
      toast.success(`Topic "#${data.topic.name}" created`);
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create topic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Topic</DialogTitle>
          <DialogDescription>
            Create a new chat topic for your clan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic-name">Name</Label>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gold Signals"
              maxLength={TOPIC_NAME_MAX}
              required
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/{TOPIC_NAME_MAX}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-description">Description (optional)</Label>
            <Textarea
              id="topic-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this topic about?"
              maxLength={TOPIC_DESCRIPTION_MAX}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || name.trim().length < TOPIC_NAME_MIN}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
