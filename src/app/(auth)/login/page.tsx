"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const TEST_ACCOUNTS = [
  { label: "Admin", email: "admin@clantrader.ir", role: "ADMIN" },
  { label: "Ali (Leader)", email: "trader1@clantrader.ir", role: "TRADER" },
  { label: "Sara (Co-Leader)", email: "trader2@clantrader.ir", role: "TRADER" },
  { label: "Reza (Member)", email: "trader3@clantrader.ir", role: "TRADER" },
  { label: "Viewer", email: "spectator@clantrader.ir", role: "SPECTATOR" },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // EA token state
  const [eaExpanded, setEaExpanded] = useState(false);
  const [token, setToken] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setLoading(true);
    setError(null);

    // Detect email vs username
    const isEmail = identifier.includes("@");
    const result = await signIn("credentials", {
      ...(isEmail
        ? { email: identifier.trim() }
        : { username: identifier.trim() }),
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError(t("auth.invalidCredentials"));
      return;
    }
    router.push("/home");
    router.refresh();
  }

  async function handleTokenLogin() {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signIn("ea", { token: token.trim(), redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(t("auth.tokenFailed"));
      return;
    }
    router.push("/home");
    router.refresh();
  }

  async function quickLogin(email: string) {
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password: "password123",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(t("auth.quickLoginFailed"));
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("auth.signInTitle")}</CardTitle>
        <CardDescription>
          {t("auth.signInSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">{t("auth.usernameOrEmail")}</Label>
            <Input
              id="identifier"
              type="text"
              placeholder={t("auth.usernameOrEmailPlaceholder")}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="w-full"
          >
            {loading ? t("common.signingIn") : t("auth.signIn")}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span>
          </div>
        </div>

        {/* Collapsible EA section */}
        <div>
          <button
            type="button"
            onClick={() => setEaExpanded(!eaExpanded)}
            className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
          >
            <span>{t("auth.signInWithEa")}</span>
            {eaExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {eaExpanded && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("auth.eaLoginHint")}
              </p>
              <Input
                placeholder={t("auth.pasteToken")}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
              />
              <Button
                onClick={handleTokenLogin}
                disabled={loading || !token.trim()}
                className="w-full"
                variant="outline"
              >
                {loading ? t("common.signingIn") : t("auth.signInWithToken")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.dontHaveAccount")}{" "}
          <Link href="/signup" className="text-primary hover:underline">
            {t("auth.signUp")}
          </Link>
        </p>
      </CardFooter>

      {/* Dev-only quick login */}
      {process.env.NEXT_PUBLIC_SHOW_DEV_LOGIN === "1" && (
        <div className="border-t px-6 py-4">
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            {t("auth.quickLoginDev")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {TEST_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={loading}
                onClick={() => quickLogin(account.email)}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
