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
import { Camera, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";

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
  isLeader?: boolean;
}

export function ClanSettingsForm({ clan, isLeader }: ClanSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
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
              {getInitials(clan.name)}
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

      {isLeader && (
        <div className="mt-8 rounded-lg border border-destructive/50 p-4">
          <h3 className="text-sm font-semibold text-destructive">
            {t("clan.dangerZone")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("clan.deleteClanWarning")}
          </p>

          {!deleteConfirmOpen ? (
            <Button
              type="button"
              variant="destructive"
              className="mt-3"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="me-2 h-4 w-4" />
              {t("clan.deleteClan")}
            </Button>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm">
                {t("clan.typeToConfirmDelete").replace("{name}", clan.name)}
              </p>
              <Input
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={clan.name}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDeleteConfirmInput("");
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteConfirmInput !== clan.name || deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const res = await fetch(`/api/clans/${clan.id}`, {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        toast.success(t("clan.clanDeleted"));
                        router.push("/explore");
                        router.refresh();
                      } else {
                        const data = await res.json();
                        toast.error(data.error || t("common.somethingWentWrong"));
                      }
                    } catch {
                      toast.error(t("common.somethingWentWrong"));
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {deleting ? t("common.loading") : t("clan.confirmDelete")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
