import Link from "next/link";
import { db } from "@/lib/db";
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
import { Shield } from "lucide-react";

interface JoinPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { ref } = await searchParams;

  let referrer: { name: string | null; username: string | null; avatar: string | null } | null = null;
  if (ref) {
    referrer = await db.user.findUnique({
      where: { username: ref },
      select: { name: true, username: true, avatar: true },
    });
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
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Join ClanTrader</CardTitle>
        <CardDescription>
          The competitive social trading platform
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
              <p className="text-sm font-medium">{referrer.name || "A trader"}</p>
              {referrer.username && (
                <p className="text-xs text-muted-foreground">@{referrer.username}</p>
              )}
              <p className="text-xs text-muted-foreground">invited you to join</p>
            </div>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Form clans, share trade signals, compete on leaderboards, and prove your edge.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup"}>
            Create Account
          </Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
