import { db } from "@/lib/db";
import { invalidateExploreCache } from "@/services/explore.service";

export async function followClan(userId: string, clanId: string) {
  // Verify clan exists
  const clan = await db.clan.findUnique({ where: { id: clanId } });
  if (!clan) {
    throw new Error("Clan not found");
  }

  const result = await db.follow.upsert({
    where: {
      followerId_followingType_followingId: {
        followerId: userId,
        followingType: "CLAN",
        followingId: clanId,
      },
    },
    update: {},
    create: {
      followerId: userId,
      followingType: "CLAN",
      followingId: clanId,
    },
  });
  await invalidateExploreCache();
  return result;
}

export async function unfollowClan(userId: string, clanId: string) {
  await db.follow.deleteMany({
    where: {
      followerId: userId,
      followingType: "CLAN",
      followingId: clanId,
    },
  });
  await invalidateExploreCache();
}

export async function isFollowing(
  userId: string,
  clanId: string
): Promise<boolean> {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingType_followingId: {
        followerId: userId,
        followingType: "CLAN",
        followingId: clanId,
      },
    },
  });
  return !!follow;
}

export async function getFollowerCount(clanId: string): Promise<number> {
  return db.follow.count({
    where: { followingType: "CLAN", followingId: clanId },
  });
}
