"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

function VerifyEmailContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const pending = searchParams.get("pending") === "true";
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<
    "pending" | "verifying" | "success" | "error"
  >(pending ? "pending" : token ? "verifying" : "error");
  const [message, setMessage] = useState(
    !pending && !token ? t("auth.verifyEmailNoToken") : ""
  );
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "rate-limited"
  >("idle");

  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!token || verifiedRef.current) return;
    verifiedRef.current = true;

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setStatus("success");
          setMessage(t("auth.verifyEmailSuccess"));
        } else {
          setStatus("error");
          setMessage(t("auth.verifyEmailError"));
        }
      } catch {
        setStatus("error");
        setMessage(t("auth.verifyEmailError"));
      }
    }

    verify();
  }, [token, t]);

  async function handleResend() {
    if (!email) return;
    setResendStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendStatus("sent");
      } else if (res.status === 429) {
        setResendStatus("rate-limited");
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("auth.verifyEmailTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "verifying" && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("auth.verifyEmailVerifying")}</span>
          </div>
        )}

        {status === "pending" && (
          <>
            <div className="flex justify-center py-2">
              <Mail className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.verifyEmailPending")}
            </p>
            {email && (
              <p className="text-center text-sm font-medium">{email}</p>
            )}
            <div className="pt-2">
              <Button
                onClick={handleResend}
                disabled={resendStatus === "sending" || resendStatus === "sent"}
                variant="outline"
                className="w-full"
              >
                {resendStatus === "sending"
                  ? t("auth.resendVerificationSending")
                  : t("auth.resendVerification")}
              </Button>
              {resendStatus === "sent" && (
                <p className="mt-2 text-center text-sm text-green-600 dark:text-green-400">
                  {t("auth.resendVerificationSent")}
                </p>
              )}
              {resendStatus === "error" && (
                <p className="mt-2 text-center text-sm text-destructive">
                  {t("auth.resendVerificationFailed")}
                </p>
              )}
              {resendStatus === "rate-limited" && (
                <p className="mt-2 text-center text-sm text-destructive">
                  {t("auth.resendVerificationRateLimit")}
                </p>
              )}
            </div>
          </>
        )}

        {status === "success" && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {message}
          </div>
        )}

        {status === "error" && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href="/login">{t("auth.goToLogin")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
