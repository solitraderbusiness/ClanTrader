"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, DM_CONTENT_MAX, CHAT_IMAGES_MAX } from "@/lib/chat-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Reply, ImagePlus, Loader2 } from "lucide-react";
import { ImageAttachmentPreview } from "@/components/shared/ImageAttachmentPreview";
import { useDmStore } from "@/stores/dm-store";

interface DmMessageInputProps {
  recipientId: string;
  disabled: boolean;
}

export function DmMessageInput({ recipientId, disabled }: DmMessageInputProps) {
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replyingTo = useDmStore((s) => s.replyingTo);
  const setReplyingTo = useDmStore((s) => s.setReplyingTo);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(SOCKET_EVENTS.DM_TYPING, recipientId);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.DM_STOP_TYPING, recipientId);
    }, 3000);
  }, [recipientId]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = CHAT_IMAGES_MAX - imageFiles.length;
    const toAdd = files.slice(0, remaining);

    setImageFiles((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    const trimmed = content.trim();
    if ((!trimmed && imageFiles.length === 0) || disabled || uploading) return;

    const socket = getSocket();

    let uploadedImages: string[] = [];
    if (imageFiles.length > 0) {
      setUploading(true);
      try {
        const formData = new FormData();
        imageFiles.forEach((f) => formData.append("images", f));
        const res = await fetch("/api/chat-images", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploadedImages = data.images;
      } catch {
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    socket.emit(SOCKET_EVENTS.SEND_DM, {
      recipientId,
      content: trimmed,
      replyToId: replyingTo?.id,
      ...(uploadedImages.length > 0 ? { images: uploadedImages } : {}),
    });

    setContent("");
    setImageFiles([]);
    setImagePreviews([]);
    setReplyingTo(null);

    // Stop typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.DM_STOP_TYPING, recipientId);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-background p-3">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
          <Reply className="h-3 w-3 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">
              {replyingTo.sender.name || "Unknown"}
            </span>
            <p className="truncate text-muted-foreground">
              {replyingTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

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
          disabled={disabled || imageFiles.length >= CHAT_IMAGES_MAX}
          title="Attach Images"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          maxLength={DM_CONTENT_MAX}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || uploading || (!content.trim() && imageFiles.length === 0)}
          className="flex-shrink-0"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
