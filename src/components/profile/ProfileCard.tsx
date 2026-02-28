"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { ProfileBadgeSection } from "@/components/profile/ProfileBadgeSection";
import type { StatementMetrics } from "@/types/statement";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ProfileCardProps {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    bio: string | null;
    avatar: string | null;
    role: string;
    tradingStyle: string | null;
    sessionPreference: string | null;
    preferredPairs: string[];
    isPro: boolean;
    createdAt: string;
    clanMemberships?: {
      role: string;
      clan: { id: string; name: string; avatar: string | null };
    }[];
    statements?: {
      extractedMetrics: Record<string, unknown> | null;
      verificationMethod: string;
    }[];
  };
  isOwnProfile?: boolean;
}

export function ProfileCard({ user, isOwnProfile }: ProfileCardProps) {
  const { t } = useTranslation();
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const isVerified = (user.statements?.length ?? 0) > 0;
  const clan = user.clanMemberships?.[0];
  const hasTradeDetails =
    user.tradingStyle || user.sessionPreference || user.preferredPairs.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.avatar || undefined} alt={user.name || "User"} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{user.name || "Anonymous"}</h1>
            {isVerified && (
              <Badge variant="default" className="text-xs">
                {t("profile.verified")}
              </Badge>
            )}
            {user.isPro && (
              <Badge variant="secondary" className="text-xs">
                {t("profile.pro")}
              </Badge>
            )}
          </div>
          {user.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
          {user.bio && (
            <p className="text-muted-foreground">{user.bio}</p>
          )}
        </div>
      </div>

      {/* Verified Trading Stats (lead with credibility) */}
      {isVerified && user.statements?.[0]?.extractedMetrics ? (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">{t("profile.verifiedStats")}</h3>
          <MetricsDisplay
            metrics={user.statements[0].extractedMetrics as unknown as StatementMetrics}
            compact
            verificationMethod={user.statements[0].verificationMethod}
          />
        </div>
      ) : isOwnProfile ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("profile.becomeVerified")}</p>
            <p className="text-xs text-muted-foreground">
              {t("profile.becomeVerifiedDesc")}
            </p>
          </div>
          <Link
            href="/settings/mt-accounts"
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            {t("profile.connect")}
          </Link>
        </div>
      ) : null}

      {/* Badges */}
      <ProfileBadgeSection userId={user.id} />

      {/* Clan */}
      {clan ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t("admin.clan")}</p>
          <p className="font-medium">
            <Link
              href={`/clans/${clan.clan.id}`}
              className="text-primary hover:underline"
            >
              {clan.clan.name}
            </Link>{" "}
            <span className="text-xs text-muted-foreground">
              ({clan.role.toLowerCase().replace("_", "-")})
            </span>
          </p>
        </div>
      ) : isOwnProfile ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("profile.emptyProfile")}
          </p>
          <Link
            href="/discover"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            {t("profile.setupProfile")}
          </Link>
        </div>
      ) : null}

      {/* Trading Details (preferences — least important) */}
      {hasTradeDetails ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {user.tradingStyle && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t("profile.tradingStyle")}</p>
              <p className="font-medium">
                <Link
                  href={`/explore?tab=agents&tradingStyle=${user.tradingStyle}`}
                  className="text-primary hover:underline"
                >
                  {user.tradingStyle}
                </Link>
              </p>
            </div>
          )}
          {user.sessionPreference && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t("profile.preferredSession")}</p>
              <p className="font-medium">
                <Link
                  href={`/explore?tab=agents&sessionPreference=${user.sessionPreference}`}
                  className="text-primary hover:underline"
                >
                  {user.sessionPreference}
                </Link>
              </p>
            </div>
          )}
          {user.preferredPairs.length > 0 && (
            <div className="rounded-lg border p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">{t("profile.preferredPairs")}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.preferredPairs.map((pair) => (
                  <Link
                    key={pair}
                    href={`/explore?tab=agents&preferredPair=${pair}`}
                    className="text-primary hover:underline"
                  >
                    <Badge variant="outline" className="text-xs">
                      {pair}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isOwnProfile ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t("profile.emptyProfile")}
          </p>
          <Link
            href="/settings/profile"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            {t("profile.setupProfile")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
