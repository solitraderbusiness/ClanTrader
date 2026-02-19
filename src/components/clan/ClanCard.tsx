import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Heart } from "lucide-react";

interface ClanCardProps {
  clan: {
    id: string;
    name: string;
    description?: string | null;
    avatar?: string | null;
    tradingFocus?: string | null;
    tier: string;
    _count?: { members: number };
    followerCount?: number;
  };
  role?: string | null;
}

export function ClanCard({ clan, role }: ClanCardProps) {
  const memberCount = clan._count?.members ?? 0;
  const followerCount = clan.followerCount ?? 0;

  return (
    <Link href={`/clans/${clan.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={clan.avatar || undefined} alt={clan.name} />
            <AvatarFallback>
              {clan.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate font-semibold">{clan.name}</h3>
              {clan.tradingFocus && (
                <Badge variant="secondary" className="shrink-0">
                  {clan.tradingFocus}
                </Badge>
              )}
              <Badge variant="outline" className="shrink-0">
                {clan.tier}
              </Badge>
            </div>
            {clan.description && (
              <p className="truncate text-sm text-muted-foreground">
                {clan.description}
              </p>
            )}
            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount} members
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {followerCount} followers
              </span>
              {role && (
                <Badge variant="outline" className="text-[10px]">
                  {role}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
