"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "./AvatarUpload";
import { toast } from "sonner";

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
    bio: string | null;
    avatar: string | null;
    tradingStyle: string | null;
    sessionPreference: string | null;
    preferredPairs: string[];
  };
}

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(
    user.preferredPairs
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user.name || "",
      bio: user.bio || "",
      tradingStyle: user.tradingStyle || "",
      sessionPreference: user.sessionPreference || "",
      preferredPairs: user.preferredPairs,
    },
  });

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
      router.refresh();
    } else {
      toast.error("Failed to update profile");
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
