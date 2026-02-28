import Link from "next/link";
import { headers, cookies } from "next/headers";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { trackEvent } from "@/services/referral.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CandlestickChart } from "lucide-react";
import { t } from "@/lib/i18n-core";
import type { Locale } from "@/lib/locale";

interface JoinPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { ref } = await searchParams;
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "fa";

  let referrer: { id: string; name: string | null; username: string | null; avatar: string | null } | null = null;
  if (ref) {
    referrer = await db.user.findUnique({
      where: { username: ref },
      select: { id: true, name: true, username: true, avatar: true },
    });

    // Track click event
    if (referrer) {
      const headersList = await headers();
      const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const userAgent = headersList.get("user-agent") || undefined;
      trackEvent("LINK_CLICKED", referrer.id, undefined, { ipHash, userAgent });
    }
  }

  const initials = referrer?.name
    ? referrer.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CandlestickChart className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{t(locale, "auth.joinTitle")}</CardTitle>
        <CardDescription>
          {t(locale, "auth.joinSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {referrer && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={referrer.avatar || undefined} alt={referrer.name || ""} />
              <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{referrer.name || t(locale, "auth.aTrader")}</p>
              {referrer.username && (
                <p className="text-xs text-muted-foreground">@{referrer.username}</p>
              )}
              <p className="text-xs text-muted-foreground">{t(locale, "auth.invitedBy")}</p>
            </div>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {t(locale, "auth.joinCta")}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup"}>
            {t(locale, "auth.createAccount")}
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t(locale, "auth.canConnectMtLater")}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          {t(locale, "auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t(locale, "auth.signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
