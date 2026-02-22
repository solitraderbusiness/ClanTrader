import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { ProfileBadgeSection } from "@/components/profile/ProfileBadgeSection";
import type { StatementMetrics } from "@/types/statement";
import Link from "next/link";

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
                Verified
              </Badge>
            )}
            {user.isPro && (
              <Badge variant="secondary" className="text-xs">
                PRO
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

      {/* Badges */}
      <ProfileBadgeSection userId={user.id} />

      {/* Trading Details */}
      {hasTradeDetails ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {user.tradingStyle && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Trading Style</p>
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
              <p className="text-xs text-muted-foreground">Preferred Session</p>
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
              <p className="text-xs text-muted-foreground">Preferred Pairs</p>
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
            Your trading profile is empty.
          </p>
          <Link
            href="/settings/profile"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            Set up your trading style, session, and pairs
          </Link>
        </div>
      ) : null}

      {/* Clan */}
      {clan ? (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Clan</p>
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
            You&apos;re not in a clan yet.
          </p>
          <Link
            href="/discover"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            Discover and join a clan
          </Link>
        </div>
      ) : null}

      {/* Verified Trading Stats */}
      {isVerified && user.statements?.[0]?.extractedMetrics ? (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Verified Trading Stats</h3>
          <MetricsDisplay
            metrics={user.statements[0].extractedMetrics as unknown as StatementMetrics}
            compact
            verificationMethod={user.statements[0].verificationMethod}
          />
        </div>
      ) : isOwnProfile ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No verified trading statement yet.
          </p>
          <Link
            href="/statements/upload"
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            Upload your MetaTrader statement to get verified
          </Link>
        </div>
      ) : null}
    </div>
  );
}
