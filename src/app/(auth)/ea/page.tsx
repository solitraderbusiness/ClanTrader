"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function EaCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (attempted.current || !token) return;
    attempted.current = true;

    async function doLogin() {
      const result = await signIn("ea", { token, redirect: false });

      if (result?.error) {
        setError("Token expired or invalid. Please try again from MetaTrader.");
        return;
      }

      router.push("/home");
      router.refresh();
    }

    doLogin();
  }, [token, router]);

  // No token
  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>MetaTrader Auto-Login</CardTitle>
          <CardDescription>
            This page signs you in automatically when you click
            &quot;Login&quot; or &quot;Register&quot; in the ClanTrader EA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No login token was found. If you were trying to sign in from
            MetaTrader, please try again from the EA.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Login Failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default" size="sm">
              <Link href="/login">Sign in with password</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">
          Signing you in from MetaTrader...
        </p>
      </CardContent>
    </Card>
  );
}

export default function EaCallbackPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      }
    >
      <EaCallbackInner />
    </Suspense>
  );
}
