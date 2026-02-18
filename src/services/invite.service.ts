import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { INVITE_CODE_LENGTH } from "@/lib/clan-constants";
import { addMember } from "@/services/clan.service";
import type { CreateInviteInput } from "@/lib/validators";

export class InviteServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "InviteServiceError";
  }
}

export async function createInvite(
  clanId: string,
  userId: string,
  data: CreateInviteInput
) {
  // Check permission: LEADER or CO_LEADER
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new InviteServiceError(
      "Only leaders and co-leaders can create invites",
      "FORBIDDEN",
      403
    );
  }

  const code = nanoid(INVITE_CODE_LENGTH);
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)
    : null;

  return db.clanInvite.create({
    data: {
      clanId,
      code,
      expiresAt,
      maxUses: data.maxUses ?? null,
    },
  });
}

export async function getInviteByCode(code: string) {
  const invite = await db.clanInvite.findUnique({
    where: { code },
    include: {
      clan: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!invite) {
    throw new InviteServiceError("Invite not found", "NOT_FOUND", 404);
  }

  // Check if expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new InviteServiceError("This invite has expired", "EXPIRED", 410);
  }

  // Check if max uses reached
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new InviteServiceError(
      "This invite has reached its maximum uses",
      "MAX_USES_REACHED",
      410
    );
  }

  return invite;
}

export async function redeemInvite(code: string, userId: string) {
  const invite = await getInviteByCode(code);

  // addMember handles duplicate check and tier limits
  await addMember(invite.clanId, userId);

  // Increment uses
  await db.clanInvite.update({
    where: { id: invite.id },
    data: { uses: { increment: 1 } },
  });

  return invite.clan;
}

export async function getClanInvites(clanId: string) {
  return db.clanInvite.findMany({
    where: { clanId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteInvite(inviteId: string, userId: string) {
  const invite = await db.clanInvite.findUnique({
    where: { id: inviteId },
    select: { clanId: true },
  });

  if (!invite) {
    throw new InviteServiceError("Invite not found", "NOT_FOUND", 404);
  }

  // Check permission
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId: invite.clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new InviteServiceError(
      "Only leaders and co-leaders can delete invites",
      "FORBIDDEN",
      403
    );
  }

  await db.clanInvite.delete({ where: { id: inviteId } });
}
