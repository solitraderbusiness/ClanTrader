"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usernameSchema } from "@/lib/validators";
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
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUsernamePromptStore } from "@/stores/username-prompt-store";

const setUsernameFormSchema = z.object({
  username: usernameSchema,
});

type SetUsernameForm = z.infer<typeof setUsernameFormSchema>;

export function SetUsernameDialog() {
  const { isOpen, close } = useUsernamePromptStore();
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetUsernameForm>({
    resolver: zodResolver(setUsernameFormSchema),
  });

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      setUsernameError(null);
      return;
    }

    setUsernameStatus("checking");
    setUsernameError(null);

    try {
      const res = await fetch(
        `/api/users/check-username?username=${encodeURIComponent(username)}`
      );
      const data = await res.json();

      if (data.error) {
        setUsernameStatus("invalid");
        setUsernameError(data.error);
      } else if (data.available) {
        setUsernameStatus("available");
      } else {
        setUsernameStatus("taken");
        setUsernameError("This username is already taken");
      }
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  async function onSubmit(data: SetUsernameForm) {
    setLoading(true);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.username }),
    });

    setLoading(false);

    if (res.ok) {
      toast.success("Username set!");
      close();
      // Hard refresh to update JWT with new username
      window.location.reload();
    } else {
      const result = await res.json();
      toast.error(result.error || "Failed to set username");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your username</DialogTitle>
          <DialogDescription>
            Pick a unique username for your ClanTrader profile. This will be
            visible to other users and used for mentions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-username">Username</Label>
            <div className="relative">
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="set-username"
                placeholder="alitrader"
                className="ps-7"
                autoFocus
                {...register("username", {
                  onBlur: (e) => checkUsername(e.target.value),
                })}
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
            {!errors.username && usernameError && (
              <p className="text-sm text-destructive">{usernameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              3-30 characters, lowercase letters, numbers, and underscores only.
              Must start with a letter.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Setting username..." : "Set username"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
