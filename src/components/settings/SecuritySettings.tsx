"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addEmailSchema, type AddEmailInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { CheckCircle2, Phone, Mail, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface SecuritySettingsProps {
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + "***" + phone.slice(-2);
}

export function SecuritySettings({
  phone,
  phoneVerified,
  email,
  emailVerified,
  hasPassword,
}: SecuritySettingsProps) {
  const router = useRouter();
  const { update } = useSession();
  const { t } = useTranslation();
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddEmailInput>({
    resolver: zodResolver(addEmailSchema),
  });

  async function handlePhoneVerified(token: string) {
    setError(null);
    try {
      const res = await fetch("/api/users/me/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.phoneUpdateFailed"));
        return;
      }
      await update();
      setShowChangePhone(false);
      setSuccess(t("auth.phoneUpdated"));
      router.refresh();
    } catch {
      setError(t("auth.somethingWrong"));
    }
  }

  async function onAddEmail(data: AddEmailInput) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/users/me/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || t("auth.addEmailFailed"));
        setLoading(false);
        return;
      }
      setSuccess(result.message);
      setShowAddEmail(false);
      reset();
      router.refresh();
    } catch {
      setError(t("auth.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Phone Section */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">{t("auth.phoneNumber")}</h3>
        </div>
        {phone ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm" dir="ltr">{maskPhone(phone)}</span>
              {phoneVerified && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangePhone(!showChangePhone)}
            >
              {showChangePhone ? t("common.cancel") : t("auth.phoneChange")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("auth.noPhoneSet")}</p>
        )}
        {showChangePhone && (
          <div className="pt-2">
            <PhoneOtpForm mode="add-phone" onVerified={handlePhoneVerified} />
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">{t("auth.emailPassword")}</h3>
        </div>
        {email ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{email}</span>
            {emailVerified && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {hasPassword && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                Password set
              </span>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("auth.addEmailDesc")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddEmail(!showAddEmail)}
            >
              {showAddEmail ? t("common.cancel") : t("auth.addEmailPassword")}
            </Button>
            {showAddEmail && (
              <form onSubmit={handleSubmit(onAddEmail)} className="space-y-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="add-email">{t("auth.email")}</Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-password">{t("auth.password")}</Label>
                  <Input
                    id="add-password"
                    type="password"
                    placeholder={t("auth.minChars")}
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-confirm-password">{t("auth.confirmPassword")}</Label>
                  <Input
                    id="add-confirm-password"
                    type="password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t("auth.saving")}
                    </>
                  ) : (
                    t("auth.saveEmailPassword")
                  )}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
