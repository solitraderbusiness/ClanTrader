"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClanSchema, type CreateClanInput } from "@/lib/validators";
import { TRADING_FOCUSES } from "@/lib/clan-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function ClanCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateClanInput>({
    resolver: zodResolver(createClanSchema),
    defaultValues: {
      name: "",
      description: "",
      tradingFocus: "",
      isPublic: true,
    },
  });

  async function onSubmit(data: CreateClanInput) {
    setLoading(true);

    try {
      const res = await fetch("/api/clans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isPublic }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Clan created successfully!");
        router.push(`/clans/${result.id}`);
      } else {
        toast.error(result.error || "Failed to create clan");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Clan Name</Label>
        <Input
          id="name"
          placeholder="e.g. Gold Snipers"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Tell others what your clan is about..."
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tradingFocus">Trading Focus</Label>
        <select
          id="tradingFocus"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("tradingFocus")}
        >
          <option value="">Select a focus</option>
          {TRADING_FOCUSES.map((focus) => (
            <option key={focus} value={focus}>
              {focus}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="isPublic"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
        <Label htmlFor="isPublic">
          {isPublic ? "Public — anyone can join" : "Private — invite only"}
        </Label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating..." : "Create Clan"}
      </Button>
    </form>
  );
}
