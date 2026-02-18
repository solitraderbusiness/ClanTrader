import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileCard } from "@/components/profile/ProfileCard";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
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
        where: { verificationStatus: "VERIFIED" },
        orderBy: { uploadedAt: "desc" },
        take: 1,
        select: {
          extractedMetrics: true,
          verificationMethod: true,
        },
      },
    },
  });

  if (!user) notFound();

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
    </div>
  );
}
