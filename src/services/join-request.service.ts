import { db } from "@/lib/db";
import { addMember } from "@/services/clan.service";

export class JoinRequestServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "JoinRequestServiceError";
  }
}

export async function createJoinRequest(
  clanId: string,
  userId: string,
  message?: string
) {
  // Check clan exists and has join requests enabled
  const clan = await db.clan.findUnique({ where: { id: clanId } });
  if (!clan) {
    throw new JoinRequestServiceError("Clan not found", "NOT_FOUND", 404);
  }

  const settings = (clan.settings as Record<string, unknown>) || {};
  if (!settings.joinRequestsEnabled) {
    throw new JoinRequestServiceError(
      "This clan is not accepting join requests",
      "REQUESTS_DISABLED",
      403
    );
  }

  // One-clan-per-user check
  const existingMembership = await db.clanMember.findFirst({
    where: { userId },
  });

  if (existingMembership) {
    throw new JoinRequestServiceError(
      "You must leave your current clan before requesting to join another",
      "ALREADY_IN_CLAN",
      409
    );
  }

  // Check for existing request
  const existing = await db.clanJoinRequest.findUnique({
    where: { clanId_userId: { clanId, userId } },
  });

  if (existing) {
    if (existing.status === "PENDING") {
      throw new JoinRequestServiceError(
        "You already have a pending request for this clan",
        "DUPLICATE_REQUEST",
        409
      );
    }

    // If previously rejected, allow re-requesting by resetting to PENDING
    if (existing.status === "REJECTED") {
      return db.clanJoinRequest.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          message: message || null,
          reviewedById: null,
          reviewedAt: null,
          rejectReason: null,
        },
      });
    }

    // If already approved, they should already be a member
    throw new JoinRequestServiceError(
      "Request already processed",
      "ALREADY_PROCESSED",
      409
    );
  }

  const joinReq = await db.clanJoinRequest.create({
    data: {
      clanId,
      userId,
      message: message || null,
    },
  });

  // Notify clan leader(s) about new join request
  const requester = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const leaders = await db.clanMember.findMany({
    where: { clanId, role: { in: ["LEADER", "CO_LEADER"] } },
    select: { userId: true },
  });
  for (const leader of leaders) {
    import("@/services/notification-triggers").then(({ notifyClanJoinRequest }) =>
      notifyClanJoinRequest(leader.userId, requester?.name ?? "Someone", clan.name).catch(() => {})
    );
  }

  return joinReq;
}

export async function getClanJoinRequests(clanId: string, reviewerId: string) {
  // Verify reviewer is LEADER or CO_LEADER
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: reviewerId, clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new JoinRequestServiceError(
      "Only leaders and co-leaders can view join requests",
      "FORBIDDEN",
      403
    );
  }

  return db.clanJoinRequest.findMany({
    where: { clanId, status: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          tradingStyle: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function reviewJoinRequest(
  requestId: string,
  reviewerId: string,
  action: "APPROVED" | "REJECTED",
  rejectReason?: string
) {
  const request = await db.clanJoinRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new JoinRequestServiceError("Request not found", "NOT_FOUND", 404);
  }

  if (request.status !== "PENDING") {
    throw new JoinRequestServiceError(
      "Request has already been reviewed",
      "ALREADY_REVIEWED",
      409
    );
  }

  // Verify reviewer is LEADER or CO_LEADER
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId: reviewerId, clanId: request.clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new JoinRequestServiceError(
      "Only leaders and co-leaders can review join requests",
      "FORBIDDEN",
      403
    );
  }

  // Get clan name for notification copy
  const clan = await db.clan.findUnique({ where: { id: request.clanId }, select: { name: true } });
  const clanName = clan?.name ?? "the clan";

  if (action === "APPROVED") {
    // Approve: update request + add member in a transaction
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.clanJoinRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });

      await addMember(request.clanId, request.userId, tx);

      return u;
    });

    // Notify the requester
    import("@/services/notification-triggers").then(({ notifyClanJoinApproved }) =>
      notifyClanJoinApproved(request.userId, clanName).catch(() => {})
    );

    // Notify leader that member joined
    const member = await db.user.findUnique({ where: { id: request.userId }, select: { name: true } });
    import("@/services/notification-triggers").then(({ notifyClanMemberJoined }) =>
      notifyClanMemberJoined(reviewerId, member?.name ?? "A new member", clanName).catch(() => {})
    );

    return updated;
  }

  // Reject
  const rejected = await db.clanJoinRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      rejectReason: rejectReason || null,
    },
  });

  // Notify the requester
  import("@/services/notification-triggers").then(({ notifyClanJoinRejected }) =>
    notifyClanJoinRejected(request.userId, clanName).catch(() => {})
  );

  return rejected;
}

export async function getUserJoinRequestStatus(clanId: string, userId: string) {
  const request = await db.clanJoinRequest.findUnique({
    where: { clanId_userId: { clanId, userId } },
    select: { status: true },
  });

  return request?.status || null;
}

export async function getPendingRequestCount(clanId: string) {
  return db.clanJoinRequest.count({
    where: { clanId, status: "PENDING" },
  });
}
