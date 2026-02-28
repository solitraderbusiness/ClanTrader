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
import { useTranslation } from "@/lib/i18n";

export function ClanCreateForm() {
  const { t } = useTranslation();
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
        router.push(`/clans/${result.id}`);
      } else {
        toast.error(result.error || "Failed to create clan");
      }
    } catch {
      toast.error(t("auth.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">{t("clan.clanName")}</Label>
        <Input
          id="name"
          placeholder={t("clan.clanNamePlaceholder")}
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("clan.clanNameHint")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("clan.description")}</Label>
        <Textarea
          id="description"
          placeholder={t("clan.descriptionPlaceholder")}
          rows={3}
          {...register("description")}
        />
        {errors.description ? (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("clan.descriptionHint")}
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
        <p className="text-xs text-muted-foreground">
          {t("clan.focusHint")}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            id="isPublic"
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
          <Label htmlFor="isPublic">
            {isPublic ? t("clan.publicClan") : t("clan.privateClan")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {isPublic
            ? t("clan.publicHint")
            : t("clan.privateHint")}
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t("common.creating") : t("clan.createClan")}
      </Button>

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium">{t("clan.whatNext")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("clan.whatNextDesc")}
        </p>
      </div>
    </form>
  );
}
