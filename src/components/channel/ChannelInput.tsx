"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageAttachmentPreview } from "@/components/shared/ImageAttachmentPreview";
import { Send, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CHANNEL_POST_CONTENT_MAX,
  CHANNEL_POST_IMAGES_MAX,
} from "@/lib/clan-constants";
import type { ChannelPostData } from "./ChannelStream";
import { useTranslation } from "@/lib/i18n";

interface ChannelInputProps {
  clanId: string;
  onPostCreated: (post: ChannelPostData) => void;
}

export function ChannelInput({ clanId, onPostCreated }: ChannelInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = CHANNEL_POST_IMAGES_MAX - imageFiles.length;
    const toAdd = files.slice(0, remaining);

    setImageFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    const trimmed = content.trim();
    if ((!trimmed && imageFiles.length === 0) || sending) return;

    setSending(true);
    try {
      // Upload images first if any
      let uploadedImages: string[] = [];
      if (imageFiles.length > 0) {
        const formData = new FormData();
        imageFiles.forEach((f) => formData.append("images", f));
        const uploadRes = await fetch(
          `/api/clans/${clanId}/posts/images`,
          { method: "POST", body: formData }
        );
        if (!uploadRes.ok) {
          toast.error("Failed to upload images");
          setSending(false);
          return;
        }
        const uploadData = await uploadRes.json();
        uploadedImages = uploadData.images;
      }

      // Create the post
      const res = await fetch(`/api/clans/${clanId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed || " ",
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Failed to create post");
        setSending(false);
        return;
      }

      const newPost = await res.json();

      // Normalize the response to match ChannelPostData
      onPostCreated({
        id: newPost.id,
        title: newPost.title || null,
        content: newPost.content,
        images: newPost.images || [],
        isPremium: newPost.isPremium || false,
        locked: false,
        viewCount: 0,
        reactions: null,
        createdAt: newPost.createdAt,
        author: newPost.author,
        tradeCard: null,
      });

      // Reset form
      setContent("");
      setImageFiles([]);
      setImagePreviews([]);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="border-t bg-card/80 p-3 backdrop-blur-sm"
      style={{ boxShadow: "var(--chat-input-shadow)" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
      <ImageAttachmentPreview previews={imagePreviews} onRemove={removeImage} />
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-[40px] w-[40px] shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || imageFiles.length >= CHANNEL_POST_IMAGES_MAX}
          title={t("chat.attachImages")}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.postToChannel")}
          disabled={sending}
          maxLength={CHANNEL_POST_CONTENT_MAX}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none rounded-xl bg-muted/30"
        />
        <Button
          size="icon"
          className="rounded-full"
          onClick={handleSend}
          disabled={sending || (!content.trim() && imageFiles.length === 0)}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-1 text-end text-xs text-muted-foreground">
        {content.length}/{CHANNEL_POST_CONTENT_MAX}
      </p>
    </div>
  );
}
