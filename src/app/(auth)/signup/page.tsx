"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { signupSchema, type SignupInput } from "@/lib/validators";
import { useTranslation } from "@/lib/i18n";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function SignupForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref") || "";
  const tokenFromUrl = searchParams.get("token") || "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // EA token section
  const [eaExpanded, setEaExpanded] = useState(!!tokenFromUrl);
  const [token, setToken] = useState(tokenFromUrl);
  const [eaLoading, setEaLoading] = useState(false);

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { ref: refParam || undefined },
  });

  const watchedUsername = watch("username");

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    try {
      const res = await fetch(
        `/api/users/check-username?username=${encodeURIComponent(username)}`
      );
      const data = await res.json();
      if (data.error) {
        setUsernameStatus("invalid");
      } else {
        setUsernameStatus(data.available ? "available" : "taken");
      }
    } catch {
      setUsernameStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    usernameTimer.current = setTimeout(() => {
      checkUsername(watchedUsername);
    }, 500);
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
    };
  }, [watchedUsername, checkUsername]);

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Auto sign-in via username + password
      const signInResult = await signIn("credentials", {
        username: data.username,
        password: data.password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account was created but auto-login failed — send to login
        router.push("/login");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError(t("auth.somethingWrong"));
      setLoading(false);
    }
  }

  async function handleTokenSignup() {
    if (!token.trim()) return;
    setEaLoading(true);
    setError(null);
    const result = await signIn("ea", { token: token.trim(), redirect: false });
    setEaLoading(false);
    if (result?.error) {
      setError(t("auth.regTokenFailed"));
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Primary: Web signup form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.signUpTitle")}</CardTitle>
          <CardDescription>
            {t("auth.signUpSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {refParam && (
              <input type="hidden" {...register("ref")} value={refParam} />
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input
                id="name"
                placeholder={t("auth.namePlaceholder")}
                autoComplete="name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder={t("auth.usernamePlaceholder")}
                  autoComplete="username"
                  {...register("username")}
                />
                <div className="absolute inset-y-0 end-0 flex items-center pe-3">
                  {usernameStatus === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {usernameStatus === "available" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              {errors.username && (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
              {usernameStatus === "taken" && !errors.username && (
                <p className="text-xs text-destructive">
                  {t("auth.usernameTaken")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("auth.minChars")}
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || usernameStatus === "taken"}
              className="w-full"
            >
              {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Secondary: MetaTrader EA section */}
      <div className="rounded-lg border bg-card p-4">
        <button
          type="button"
          onClick={() => setEaExpanded(!eaExpanded)}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          <span>{t("auth.alreadyHaveMt")}</span>
          {eaExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {eaExpanded && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("auth.mtConnectHint")}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/ea/ClanTrader_EA.mq4" download>
                  <Download className="me-1.5 h-4 w-4" />
                  MT4 (.mq4)
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/ea/ClanTrader_EA.mq5" download>
                  <Download className="me-1.5 h-4 w-4" />
                  MT5 (.mq5)
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("auth.eaDisclaimer")}
            </p>

            <div className="border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                {t("auth.haveRegToken")}
              </p>
              <div className="space-y-2">
                <Input
                  placeholder={t("auth.pasteRegToken")}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleTokenSignup()
                  }
                />
                <Button
                  onClick={handleTokenSignup}
                  disabled={eaLoading || !token.trim()}
                  className="w-full"
                  variant="outline"
                >
                  {eaLoading
                    ? t("auth.creatingAccount")
                    : t("auth.registerWithToken")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
