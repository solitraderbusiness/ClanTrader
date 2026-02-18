import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ProfileCardProps {
  user: {
    id: string;
    name: string | null;
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
}

export function ProfileCard({ user }: ProfileCardProps) {
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const isVerified =
    user.role === "TRADER" && (user.statements?.length ?? 0) > 0;
  const clan = user.clanMemberships?.[0];

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
          {user.bio && (
            <p className="text-muted-foreground">{user.bio}</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        {user.tradingStyle && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Trading Style</p>
            <p className="font-medium">{user.tradingStyle}</p>
          </div>
        )}
        {user.sessionPreference && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Preferred Session</p>
            <p className="font-medium">{user.sessionPreference}</p>
          </div>
        )}
        {user.preferredPairs.length > 0 && (
          <div className="rounded-lg border p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Preferred Pairs</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.preferredPairs.map((pair) => (
                <Badge key={pair} variant="outline" className="text-xs">
                  {pair}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clan */}
      {clan && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Clan</p>
          <p className="font-medium">
            {clan.clan.name}{" "}
            <span className="text-xs text-muted-foreground">
              ({clan.role.toLowerCase().replace("_", "-")})
            </span>
          </p>
        </div>
      )}

      {/* Verified stats placeholder */}
      {isVerified && user.statements?.[0]?.extractedMetrics && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">Verified Trading Stats</h3>
          <p className="text-sm text-muted-foreground">
            Detailed stats will be displayed after Phase 2 (Statement Parser).
          </p>
        </div>
      )}
    </div>
  );
}
