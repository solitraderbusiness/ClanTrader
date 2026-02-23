"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import {
  Download,
  Monitor,
  LogIn,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TEST_ACCOUNTS = [
  { label: "Admin", email: "admin@clantrader.ir", role: "ADMIN" },
  { label: "Ali (Leader)", email: "trader1@clantrader.ir", role: "TRADER" },
  { label: "Sara (Co-Leader)", email: "trader2@clantrader.ir", role: "TRADER" },
  { label: "Reza (Member)", email: "trader3@clantrader.ir", role: "TRADER" },
  { label: "Spectator", email: "spectator@clantrader.ir", role: "SPECTATOR" },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenExpanded, setTokenExpanded] = useState(false);
  const [token, setToken] = useState("");

  async function handleTokenLogin() {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signIn("ea", { token: token.trim(), redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Login failed. Token may be invalid or expired.");
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
      setError("Quick login failed — run npm run db:seed first");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in with MetaTrader</CardTitle>
        <CardDescription>
          Use the ClanTrader EA to connect your trading account
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

        {/* Step 3: Login */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
            3
          </div>
          <div className="flex-1">
            <p className="font-medium">Click &quot;Login&quot; in the EA</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The EA will open your browser and sign you in automatically.
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
            <span>Already have a login token?</span>
            {tokenExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {tokenExpanded && (
            <div className="mt-3 space-y-3">
              <Input
                placeholder="Paste your login token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
              />
              <Button
                onClick={handleTokenLogin}
                disabled={loading || !token.trim()}
                className="w-full"
              >
                {loading ? "Signing in..." : "Sign in with token"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>

      {/* Dev-only quick login */}
      {process.env.NODE_ENV === "development" && (
        <div className="border-t px-6 py-4">
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            Quick Login (Dev Only)
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

/*
 * =============================================
 * PRESERVED: Phone/Email auth (for future re-activation)
 * =============================================
 *
 * import { useForm } from "react-hook-form";
 * import { zodResolver } from "@hookform/resolvers/zod";
 * import { loginSchema, type LoginInput } from "@/lib/validators";
 * import { Label } from "@/components/ui/label";
 * import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 * import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
 *
 * // Phone login handler:
 * async function handlePhoneLogin(token: string) {
 *   setLoading(true);
 *   setError(null);
 *   const result = await signIn("phone", { token, redirect: false });
 *   setLoading(false);
 *   if (result?.error) {
 *     setError("Phone login failed. Please try again.");
 *     return;
 *   }
 *   router.push("/home");
 *   router.refresh();
 * }
 *
 * // Email login form:
 * const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
 *   resolver: zodResolver(loginSchema),
 * });
 *
 * async function onSubmit(data: LoginInput) {
 *   setLoading(true);
 *   setError(null);
 *   const result = await signIn("credentials", {
 *     email: data.email, password: data.password, redirect: false,
 *   });
 *   setLoading(false);
 *   if (result?.error) { setError("Invalid email or password"); return; }
 *   router.push("/home");
 *   router.refresh();
 * }
 *
 * // Tabs UI:
 * <Tabs defaultValue="phone">
 *   <TabsList className="mb-4 w-full">
 *     <TabsTrigger value="phone" className="flex-1">Phone</TabsTrigger>
 *     <TabsTrigger value="email" className="flex-1">Email & Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="phone">
 *     <PhoneOtpForm mode="login" onVerified={handlePhoneLogin} onNewUser={handleNewUser} />
 *   </TabsContent>
 *   <TabsContent value="email">
 *     {email/password form}
 *   </TabsContent>
 * </Tabs>
 */
