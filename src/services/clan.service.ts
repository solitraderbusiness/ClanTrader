import { db } from "@/lib/db";
import { CLAN_LIMITS } from "@/lib/clan-constants";
import type { CreateClanInput, UpdateClanInput } from "@/lib/validators";
import type { ClanTier } from "@prisma/client";

export class ClanServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ClanServiceError";
  }
}

export async function createClan(userId: string, data: CreateClanInput) {
  // Check if user is already in any clan
  const existingMembership = await db.clanMember.findFirst({
    where: { userId },
  });

  if (existingMembership) {
    throw new ClanServiceError(
      "You must leave your current clan before creating a new one",
      "ALREADY_IN_CLAN",
      409
    );
  }

  // Check if clan name is taken
  const existing = await db.clan.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new ClanServiceError(
      "A clan with this name already exists",
      "NAME_TAKEN",
      409
    );
  }

  // Create clan + add creator as LEADER in a transaction
  const clan = await db.$transaction(async (tx) => {
    const newClan = await tx.clan.create({
      data: {
        name: data.name,
        description: data.description,
        tradingFocus: data.tradingFocus,
        isPublic: data.isPublic,
        createdById: userId,
      },
    });

    await tx.clanMember.create({
      data: {
        userId,
        clanId: newClan.id,
        role: "LEADER",
      },
    });

    return newClan;
  });

  return clan;
}

export async function getClan(clanId: string) {
  const clan = await db.clan.findUnique({
    where: { id: clanId },
    include: {
      createdBy: {
        select: { id: true, name: true, avatar: true },
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!clan) {
    throw new ClanServiceError("Clan not found", "NOT_FOUND", 404);
  }

  // Count followers
  const followerCount = await db.follow.count({
    where: { followingType: "CLAN", followingId: clanId },
  });

  return { ...clan, followerCount };
}

export async function updateClan(
  clanId: string,
  userId: string,
  data: UpdateClanInput
) {
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new ClanServiceError(
      "Only leaders and co-leaders can update the clan",
      "FORBIDDEN",
      403
    );
  }

  // If name is being changed, check uniqueness
  if (data.name) {
    const existing = await db.clan.findUnique({
      where: { name: data.name },
    });
    if (existing && existing.id !== clanId) {
      throw new ClanServiceError(
        "A clan with this name already exists",
        "NAME_TAKEN",
        409
      );
    }
  }

  return db.clan.update({
    where: { id: clanId },
    data,
  });
}

export async function deleteClan(clanId: string, userId: string) {
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (!membership || membership.role !== "LEADER") {
    throw new ClanServiceError(
      "Only the clan leader can delete the clan",
      "FORBIDDEN",
      403
    );
  }

  await db.clan.delete({ where: { id: clanId } });
}

export async function addMember(
  clanId: string,
  userId: string,
  txClient?: Parameters<Parameters<typeof db.$transaction>[0]>[0]
) {
  const client = txClient || db;

  // One-clan-per-user check
  const existingClan = await client.clanMember.findFirst({
    where: { userId },
  });

  if (existingClan) {
    throw new ClanServiceError(
      "You must leave your current clan before joining another",
      "ALREADY_IN_CLAN",
      409
    );
  }

  const clan = await client.clan.findUnique({
    where: { id: clanId },
    include: { _count: { select: { members: true } } },
  });

  if (!clan) {
    throw new ClanServiceError("Clan not found", "NOT_FOUND", 404);
  }

  // Check if already a member
  const existing = await client.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (existing) {
    throw new ClanServiceError(
      "Already a member of this clan",
      "ALREADY_MEMBER",
      409
    );
  }

  // Enforce tier limits
  const limit = CLAN_LIMITS[clan.tier as keyof typeof CLAN_LIMITS];
  if (clan._count.members >= limit) {
    throw new ClanServiceError(
      `Clan is full (${limit} members max for ${clan.tier} tier)`,
      "CLAN_FULL",
      403
    );
  }

  return client.clanMember.create({
    data: {
      userId,
      clanId,
      role: "MEMBER",
    },
  });
}

export async function removeMember(
  clanId: string,
  targetUserId: string,
  removedById: string
) {
  // Can't remove yourself through this — use leaveClan instead
  if (targetUserId === removedById) {
    throw new ClanServiceError(
      "Use leave clan instead",
      "USE_LEAVE",
      400
    );
  }

  const removerMembership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: removedById, clanId } },
  });

  if (!removerMembership) {
    throw new ClanServiceError("You are not a member", "FORBIDDEN", 403);
  }

  const targetMembership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: targetUserId, clanId } },
  });

  if (!targetMembership) {
    throw new ClanServiceError("Target user is not a member", "NOT_FOUND", 404);
  }

  // Permission check: LEADER can remove anyone, CO_LEADER can remove MEMBERs
  if (removerMembership.role === "LEADER") {
    // Can remove anyone
  } else if (
    removerMembership.role === "CO_LEADER" &&
    targetMembership.role === "MEMBER"
  ) {
    // Co-leaders can remove members
  } else {
    throw new ClanServiceError(
      "You don't have permission to remove this member",
      "FORBIDDEN",
      403
    );
  }

  await db.clanMember.delete({
    where: { userId_clanId: { userId: targetUserId, clanId } },
  });
}

export async function updateMemberRole(
  clanId: string,
  targetUserId: string,
  newRole: "CO_LEADER" | "MEMBER",
  updatedById: string
) {
  const updaterMembership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: updatedById, clanId } },
  });

  if (!updaterMembership || updaterMembership.role !== "LEADER") {
    throw new ClanServiceError(
      "Only the clan leader can change roles",
      "FORBIDDEN",
      403
    );
  }

  const targetMembership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: targetUserId, clanId } },
  });

  if (!targetMembership) {
    throw new ClanServiceError("Target user is not a member", "NOT_FOUND", 404);
  }

  if (targetMembership.role === "LEADER") {
    throw new ClanServiceError(
      "Cannot change the leader's role",
      "INVALID",
      400
    );
  }

  return db.clanMember.update({
    where: { userId_clanId: { userId: targetUserId, clanId } },
    data: { role: newRole },
  });
}

export async function leaveClan(clanId: string, userId: string) {
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (!membership) {
    throw new ClanServiceError("You are not a member", "NOT_FOUND", 404);
  }

  if (membership.role === "LEADER") {
    throw new ClanServiceError(
      "Leader must transfer leadership before leaving",
      "LEADER_CANNOT_LEAVE",
      400
    );
  }

  await db.clanMember.delete({
    where: { userId_clanId: { userId, clanId } },
  });
}

export async function getUserClans(userId: string) {
  const memberships = await db.clanMember.findMany({
    where: { userId },
    include: {
      clan: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // Get follower counts for all clans
  const clanIds = memberships.map((m) => m.clan.id);
  const followerCounts = await db.follow.groupBy({
    by: ["followingId"],
    where: { followingType: "CLAN", followingId: { in: clanIds } },
    _count: true,
  });

  const followerMap = new Map(
    followerCounts.map((f) => [f.followingId, f._count])
  );

  return memberships.map((m) => ({
    ...m.clan,
    role: m.role,
    joinedAt: m.joinedAt,
    followerCount: followerMap.get(m.clan.id) || 0,
  }));
}

export async function searchClans(
  query?: string,
  filters?: { tradingFocus?: string; isPublic?: boolean },
  pagination?: { page?: number; limit?: number }
) {
  const page = pagination?.page || 1;
  const limit = Math.min(pagination?.limit || 20, 50);
  const skip = (page - 1) * limit;

  const where: Parameters<typeof db.clan.findMany>[0] = {
    where: {
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(filters?.tradingFocus ? { tradingFocus: filters.tradingFocus } : {}),
      isPublic: filters?.isPublic ?? true,
    },
  };

  const [clans, total] = await Promise.all([
    db.clan.findMany({
      ...where,
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.clan.count(where as Parameters<typeof db.clan.count>[0]),
  ]);

  // Get follower counts
  const clanIds = clans.map((c) => c.id);
  const followerCounts = await db.follow.groupBy({
    by: ["followingId"],
    where: { followingType: "CLAN", followingId: { in: clanIds } },
    _count: true,
  });

  const followerMap = new Map(
    followerCounts.map((f) => [f.followingId, f._count])
  );

  return {
    clans: clans.map((c) => ({
      ...c,
      followerCount: followerMap.get(c.id) || 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function getMemberLimit(tier: ClanTier): number {
  return CLAN_LIMITS[tier];
}
