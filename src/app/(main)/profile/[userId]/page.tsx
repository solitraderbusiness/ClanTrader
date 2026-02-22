import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  bio: true,
  avatar: true,
  role: true,
  tradingStyle: true,
  sessionPreference: true,
  preferredPairs: true,
  isPro: true,
  createdAt: true,
  clanMemberships: {
    select: {
      role: true,
      clan: {
        select: { id: true, name: true, avatar: true },
      },
    },
  },
  statements: {
    where: { verificationStatus: "VERIFIED" as const },
    orderBy: { uploadedAt: "desc" as const },
    take: 1,
    select: {
      extractedMetrics: true,
      verificationMethod: true,
    },
  },
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const session = await auth();
  const { userId } = await params;

  // Try lookup by ID first, then fallback to username
  let user = await db.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    user = await db.user.findUnique({
      where: { username: userId },
      select: userSelect,
    });
  }

  if (!user) notFound();

  const isOwnProfile = session?.user?.id === user.id;

  const serialized = {
    ...user,
    createdAt: user.createdAt.toISOString(),
    statements: user.statements.map((s) => ({
      extractedMetrics: s.extractedMetrics as Record<string, unknown> | null,
      verificationMethod: s.verificationMethod,
    })),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ProfileCard user={serialized} />
      {!isOwnProfile && session?.user?.id && (
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dm/${user.id}`}>
              <Mail className="me-2 h-4 w-4" />
              Message
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
