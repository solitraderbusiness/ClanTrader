import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, Shield } from "lucide-react";

interface ClanProfileHeaderProps {
  clan: {
    id: string;
    name: string;
    description: string | null;
    avatar: string | null;
    tradingFocus: string | null;
    tier: string;
    isPublic: boolean;
  };
  memberCount: number;
  followerCount: number;
  children?: React.ReactNode;
}

export function ClanProfileHeader({
  clan,
  memberCount,
  followerCount,
  children,
}: ClanProfileHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={clan.avatar || undefined} alt={clan.name} />
          <AvatarFallback className="text-xl">
            {clan.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{clan.name}</h1>
            {clan.tradingFocus && (
              <Badge variant="secondary">{clan.tradingFocus}</Badge>
            )}
            <Badge variant="outline">{clan.tier}</Badge>
            {!clan.isPublic && (
              <Badge variant="outline">
                <Shield className="me-1 h-3 w-3" />
                Private
              </Badge>
            )}
          </div>

          {clan.description && (
            <p className="mt-1 text-muted-foreground">{clan.description}</p>
          )}

          <div className="mt-3 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {memberCount} members
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              {followerCount} followers
            </span>
          </div>
        </div>

        {children && <div className="flex gap-2">{children}</div>}
      </div>
    </div>
  );
}
