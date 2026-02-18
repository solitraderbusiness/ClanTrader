"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators";
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

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
    router.push("/dashboard");
    router.refresh();
  }

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>

      {/* Quick login for testing */}
      <div className="border-t px-6 py-4">
        <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
          Quick Login (Test Accounts)
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
    </Card>
  );
}
