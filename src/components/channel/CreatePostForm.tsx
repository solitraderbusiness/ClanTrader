"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createChannelPostSchema,
  type CreateChannelPostInput,
} from "@/lib/validators";
import { CHANNEL_POST_IMAGES_MAX } from "@/lib/clan-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

interface CreatePostFormProps {
  clanId: string;
  onSuccess?: () => void;
}

export function CreatePostForm({ clanId, onSuccess }: CreatePostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateChannelPostInput>({
    resolver: zodResolver(createChannelPostSchema),
    defaultValues: {
      title: "",
      content: "",
    },
  });

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = CHANNEL_POST_IMAGES_MAX - imageFiles.length;
    const toAdd = files.slice(0, remaining);

    setImageFiles((prev) => [...prev, ...toAdd]);

    // Create previews
    for (const file of toAdd) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(data: CreateChannelPostInput) {
    setLoading(true);

    try {
      let imageUrls: string[] = [];

      // Upload images first if any
      if (imageFiles.length > 0) {
        const formData = new FormData();
        for (const file of imageFiles) {
          formData.append("images", file);
        }

        const uploadRes = await fetch(
          `/api/clans/${clanId}/posts/images`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          toast.error(err.error || "Failed to upload images");
          setLoading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        imageUrls = uploadData.images;
      }

      // Create post
      const res = await fetch(`/api/clans/${clanId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          images: imageUrls,
          isPremium,
        }),
      });

      if (res.ok) {
        toast.success("Post published!");
        reset();
        setImageFiles([]);
        setImagePreviews([]);
        setIsPremium(false);
        router.refresh();
        onSuccess?.();
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to create post");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          placeholder="Post title..."
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          placeholder="Write your post..."
          rows={5}
          {...register("content")}
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>

      {/* Image upload */}
      <div className="space-y-2">
        <Label>Images ({imageFiles.length}/{CHANNEL_POST_IMAGES_MAX})</Label>
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {imagePreviews.map((preview, i) => (
              <div key={i} className="relative">
                <img
                  src={preview}
                  alt={`Preview ${i + 1}`}
                  className="h-20 w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {imageFiles.length < CHANNEL_POST_IMAGES_MAX && (
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent">
            <ImagePlus className="h-4 w-4" />
            Add images
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="isPremium"
          checked={isPremium}
          onCheckedChange={setIsPremium}
        />
        <Label htmlFor="isPremium">
          {isPremium
            ? "Premium — only members and pro users can view"
            : "Free — visible to everyone"}
        </Label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Publishing..." : "Publish Post"}
      </Button>
    </form>
  );
}
