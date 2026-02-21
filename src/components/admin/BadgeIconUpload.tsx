"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface BadgeIconUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export function BadgeIconUpload({ currentUrl, onUploaded }: BadgeIconUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("icon", file);

      const res = await fetch("/api/admin/badges/assets", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUploaded(data.iconUrl);
      toast.success("Icon uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {currentUrl ? (
        <img
          src={currentUrl}
          alt="Badge icon"
          className="h-10 w-10 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <Upload className="h-4 w-4" />
        </div>
      )}
      <div>
        <Button variant="outline" size="sm" asChild disabled={uploading}>
          <label className="cursor-pointer">
            {uploading ? "Uploading..." : "Upload Icon"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </Button>
      </div>
    </div>
  );
}
