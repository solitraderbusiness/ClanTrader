import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { getInitials } from "@/lib/utils";

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
    <div className="flex flex-wrap items-center gap-2">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={clan.avatar || undefined} alt={clan.name} />
        <AvatarFallback className="text-sm">
          {getInitials(clan.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-base font-bold leading-tight truncate">{clan.name}</h1>
          {clan.tradingFocus && (
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">{clan.tradingFocus}</Badge>
          )}
          {!clan.isPublic && (
            <Shield className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {memberCount} members &middot; {followerCount} followers
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}
