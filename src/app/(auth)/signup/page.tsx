"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenExpanded, setTokenExpanded] = useState(!!tokenFromUrl);
  const [token, setToken] = useState(tokenFromUrl);

  async function handleTokenSignup() {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signIn("ea", { token: token.trim(), redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Registration failed. Token may be invalid or expired.");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register with MetaTrader</CardTitle>
        <CardDescription>
          Connect your trading account to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Download EA */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
            1
          </div>
          <div className="flex-1">
            <p className="font-medium">Download the EA</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Install the ClanTrader Expert Advisor on your terminal
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/ea/ClanTrader.ex4" download>
                  <Download className="me-1.5 h-4 w-4" />
                  MT4 (.ex4)
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/ea/ClanTrader.ex5" download>
                  <Download className="me-1.5 h-4 w-4" />
                  MT5 (.ex5)
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Install */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
            2
          </div>
          <div className="flex-1">
            <p className="font-medium">Install on your terminal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Copy the EA file to your MetaTrader&apos;s{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                Experts
              </code>{" "}
              folder, then attach it to any chart.
            </p>
          </div>
        </div>

        {/* Step 3: Register */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
            3
          </div>
          <div className="flex-1">
            <p className="font-medium">
              Click &quot;Register&quot; in the EA
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The EA will create your account and open your browser automatically.
            </p>
          </div>
        </div>

        {/* Collapsible token input */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setTokenExpanded(!tokenExpanded)}
            className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
          >
            <span>Already have a registration token?</span>
            {tokenExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {tokenExpanded && (
            <div className="mt-3 space-y-3">
              <Input
                placeholder="Paste your registration token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTokenSignup()}
              />
              <Button
                onClick={handleTokenSignup}
                disabled={loading || !token.trim()}
                className="w-full"
              >
                {loading ? "Creating account..." : "Register with token"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

/*
 * =============================================
 * PRESERVED: Phone OTP signup flow (for future re-activation)
 * =============================================
 *
 * import { useCallback } from "react";
 * import { useForm } from "react-hook-form";
 * import { zodResolver } from "@hookform/resolvers/zod";
 * import { phoneSignupSchema, type PhoneSignupInput } from "@/lib/validators";
 * import { Label } from "@/components/ui/label";
 * import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
 * import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
 *
 * // Phone OTP first step (no signup token):
 * <PhoneOtpForm
 *   mode="login"
 *   onVerified={(token) => handlePhoneLogin(token)}
 *   onNewUser={handleNewUser}
 * />
 *
 * // Profile completion form (has signup token):
 * const { register, handleSubmit, formState: { errors } } = useForm<PhoneSignupInput>({
 *   resolver: zodResolver(phoneSignupSchema),
 *   defaultValues: { token: signupToken, ref: refParam || undefined },
 * });
 *
 * async function onSubmit(data: PhoneSignupInput) {
 *   const res = await fetch("/api/auth/phone-signup", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({
 *       token: signupToken, name: data.name, username: data.username,
 *       ref: refParam || undefined,
 *     }),
 *   });
 *   const result = await res.json();
 *   if (!res.ok) { setError(result.error); return; }
 *   const signInResult = await signIn("phone", { token: result.loginToken, redirect: false });
 *   if (signInResult?.error) { setError("Account created but login failed."); return; }
 *   router.push("/home");
 *   router.refresh();
 * }
 *
 * // Username check:
 * const checkUsername = useCallback(async (username: string) => {
 *   const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(username)}`);
 *   const data = await res.json();
 *   // ... set usernameStatus
 * }, []);
 */
