"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "./AvatarUpload";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const TRADING_STYLES = [
  "Scalping",
  "Day Trading",
  "Swing",
  "Position",
  "Algorithmic",
];

const SESSIONS = ["Asian", "London", "New York", "All Sessions"];

const COMMON_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "XAUUSD",
  "XAGUSD",
  "USDCHF",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "GBPJPY",
  "EURJPY",
  "BTCUSD",
];

interface ProfileEditFormProps {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    bio: string | null;
    avatar: string | null;
    tradingStyle: string | null;
    sessionPreference: string | null;
    preferredPairs: string[];
  };
}

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    user.preferredPairs
  );
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user.name || "",
      username: user.username || "",
      bio: user.bio || "",
      tradingStyle: user.tradingStyle || "",
      sessionPreference: user.sessionPreference || "",
      preferredPairs: user.preferredPairs,
    },
  });

  const checkUsername = useCallback(
    async (username: string) => {
      if (!username || username.length < 3) {
        setUsernameStatus("idle");
        setUsernameError(null);
        return;
      }

      // Don't check if it's the same as current
      if (username === user.username) {
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
    },
    [user.username]
  );

  function togglePair(pair: string) {
    setSelectedPairs((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  }

  async function onSubmit(data: ProfileUpdateInput) {
    setLoading(true);

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, preferredPairs: selectedPairs }),
    });

    setLoading(false);

    if (res.ok) {
      toast.success("Profile updated");
      // Refresh JWT so session reflects username/name changes
      await updateSession();
      router.refresh();
    } else {
      const result = await res.json();
      toast.error(result.error || "Failed to update profile");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <AvatarUpload
        currentAvatar={user.avatar}
        name={user.name}
        onUpload={() => router.refresh()}
      />

      <div className="space-y-2">
        <Label htmlFor="name">Display Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <Input
            id="username"
            placeholder="alitrader"
            className="ps-7"
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("bio")}
        />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tradingStyle">Trading Style</Label>
        <select
          id="tradingStyle"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("tradingStyle")}
        >
          <option value="">Select a style</option>
          {TRADING_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sessionPreference">Preferred Session</Label>
        <select
          id="sessionPreference"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("sessionPreference")}
        >
          <option value="">Select a session</option>
          {SESSIONS.map((session) => (
            <option key={session} value={session}>
              {session}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Preferred Pairs</Label>
        <div className="flex flex-wrap gap-2">
          {COMMON_PAIRS.map((pair) => (
            <button
              key={pair}
              type="button"
              onClick={() => togglePair(pair)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedPairs.includes(pair)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              }`}
            >
              {pair}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
