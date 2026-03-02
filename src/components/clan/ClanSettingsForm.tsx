"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateClanSchema, type UpdateClanInput } from "@/lib/validators";
import { TRADING_FOCUSES } from "@/lib/clan-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ClanSettingsFormProps {
  clan: {
    id: string;
    name: string;
    description: string | null;
    avatar: string | null;
    tradingFocus: string | null;
    isPublic: boolean;
    settings: Record<string, unknown> | null;
  };
}

export function ClanSettingsForm({ clan }: ClanSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(clan.isPublic);
  const [joinRequestsEnabled, setJoinRequestsEnabled] = useState(
    !!(clan.settings as Record<string, unknown> | null)?.joinRequestsEnabled
  );
  const [avatarUrl, setAvatarUrl] = useState(clan.avatar);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateClanInput>({
    resolver: zodResolver(updateClanSchema),
    defaultValues: {
      name: clan.name,
      description: clan.description || "",
      tradingFocus: clan.tradingFocus || "",
      isPublic: clan.isPublic,
    },
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch(`/api/clans/${clan.id}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatar);
        toast.success(t("clan.avatarUpdated"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedUploadAvatar"));
      }
    } catch {
      toast.error(t("clan.failedUploadAvatar"));
    }
  }

  async function onSubmit(data: UpdateClanInput) {
    setLoading(true);

    try {
      const res = await fetch(`/api/clans/${clan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isPublic, settings: { joinRequestsEnabled } }),
      });

      if (res.ok) {
        toast.success(t("clan.settingsUpdated"));
        router.refresh();
      } else {
        const result = await res.json();
        toast.error(result.error || t("clan.failedUpdateClan"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} alt={clan.name} />
            <AvatarFallback>
              {clan.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <label
            htmlFor="clan-avatar"
            className="absolute -bottom-1 -end-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Camera className="h-3 w-3" />
            <input
              id="clan-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("clan.avatarHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">{t("clan.clanName")}</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("clan.description")}</Label>
        <Textarea id="description" rows={3} {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tradingFocus">{t("clan.tradingFocus")}</Label>
        <select
          id="tradingFocus"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("tradingFocus")}
        >
          <option value="">{t("clan.selectFocus")}</option>
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
          {isPublic ? t("clan.publicDiscoverable") : t("clan.privateHidden")}
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="joinRequestsEnabled"
          checked={joinRequestsEnabled}
          onCheckedChange={setJoinRequestsEnabled}
        />
        <Label htmlFor="joinRequestsEnabled">
          {joinRequestsEnabled
            ? t("clan.joinRequestsEnabledLabel")
            : t("clan.joinRequestsDisabledLabel")}
        </Label>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? t("common.saving") : t("clan.saveSettings")}
      </Button>
    </form>
  );
}
