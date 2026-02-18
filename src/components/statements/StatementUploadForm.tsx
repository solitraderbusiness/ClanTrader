"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { Upload, FileCheck, AlertCircle, Loader2 } from "lucide-react";
import type { StatementMetrics } from "@/types/statement";
import { toast } from "sonner";

const ALLOWED_EXTENSIONS = [".html", ".htm"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

type UploadState = "idle" | "uploading" | "success" | "error";

export function StatementUploadForm() {
  const [state, setState] = useState<UploadState>("idle");
  const [metrics, setMetrics] = useState<StatementMetrics | null>(null);
  const [error, setError] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "Only HTML/HTM files are allowed";
    }
    if (file.size > MAX_SIZE) {
      return "File size must be under 10MB";
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setState("error");
      return;
    }

    setState("uploading");
    setError("");
    setMetrics(null);

    try {
      const formData = new FormData();
      formData.append("statement", file);

      const res = await fetch("/api/statements/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        setState("error");
        return;
      }

      setMetrics(data.metrics);
      setState("success");
      toast.success("Statement uploaded successfully");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const reset = () => {
    setState("idle");
    setMetrics(null);
    setError("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Trading Statement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "idle" || state === "error" ? (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">
                Drag and drop your MT4/MT5 HTML statement
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                or click to browse (HTML/HTM, max 10MB)
              </p>
              <label>
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
            {state === "error" && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </>
        ) : state === "uploading" ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Uploading and parsing statement...
            </p>
          </div>
        ) : state === "success" && metrics ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <FileCheck className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-600">
                Statement parsed successfully! Pending admin review.
              </p>
            </div>
            <MetricsDisplay metrics={metrics} />
            <Button onClick={reset} variant="outline">
              Upload Another Statement
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
