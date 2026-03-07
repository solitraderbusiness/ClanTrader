import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock functions
const mockClanMemberFindUnique = vi.fn();
const mockClanMemberFindFirst = vi.fn();
const mockClanMemberCreate = vi.fn();
const mockClanMemberDelete = vi.fn();
const mockClanMemberUpdate = vi.fn();
const mockClanMemberCount = vi.fn();
const mockClanFindUnique = vi.fn();
const mockClanDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    clanMember: {
      findUnique: (...args: unknown[]) => mockClanMemberFindUnique(...args),
      findFirst: (...args: unknown[]) => mockClanMemberFindFirst(...args),
      create: (...args: unknown[]) => mockClanMemberCreate(...args),
      delete: (...args: unknown[]) => mockClanMemberDelete(...args),
      update: (...args: unknown[]) => mockClanMemberUpdate(...args),
      count: (...args: unknown[]) => mockClanMemberCount(...args),
    },
    clan: {
      findUnique: (...args: unknown[]) => mockClanFindUnique(...args),
      delete: (...args: unknown[]) => mockClanDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/services/explore.service", () => ({
  invalidateExploreCache: vi.fn(),
}));

import {
  leaveClan,
  transferLeadership,
  switchClan,
  ClanServiceError,
} from "@/services/clan.service";

const CLAN_ID = "clan-1";
const TARGET_CLAN_ID = "clan-2";
const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction executes the callback with a mock tx client
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txClient = {
      clanMember: {
        delete: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      clan: {
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          id: TARGET_CLAN_ID,
          tier: "FREE",
          _count: { members: 1 },
        }),
      },
      clanJoinRequest: {
        upsert: vi.fn(),
      },
    };
    return fn(txClient);
  });
});

describe("leaveClan", () => {
  it("throws NOT_FOUND if user is not a member", async () => {
    mockClanMemberFindUnique.mockResolvedValue(null);

    await expect(leaveClan(CLAN_ID, USER_ID)).rejects.toThrow(ClanServiceError);
    await expect(leaveClan(CLAN_ID, USER_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets a regular member leave normally", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "MEMBER",
    });
    mockClanMemberDelete.mockResolvedValue({});

    await leaveClan(CLAN_ID, USER_ID);
    expect(mockClanMemberDelete).toHaveBeenCalledWith({
      where: { userId_clanId: { userId: USER_ID, clanId: CLAN_ID } },
    });
  });

  it("auto-dissolves when solo leader leaves", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "LEADER",
    });
    mockClanMemberCount.mockResolvedValue(1);

    await leaveClan(CLAN_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("throws LEADER_CANNOT_LEAVE if leader with multiple members", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "LEADER",
    });
    mockClanMemberCount.mockResolvedValue(3);

    await expect(leaveClan(CLAN_ID, USER_ID)).rejects.toMatchObject({
      code: "LEADER_CANNOT_LEAVE",
    });
  });
});

describe("transferLeadership", () => {
  it("throws INVALID when transferring to self", async () => {
    await expect(
      transferLeadership(CLAN_ID, USER_ID, USER_ID)
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("throws FORBIDDEN if caller is not leader", async () => {
    mockClanMemberFindUnique.mockResolvedValueOnce({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "MEMBER",
    });

    await expect(
      transferLeadership(CLAN_ID, OTHER_USER_ID, USER_ID)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND if target is not a member", async () => {
    mockClanMemberFindUnique
      .mockResolvedValueOnce({ userId: USER_ID, clanId: CLAN_ID, role: "LEADER" })
      .mockResolvedValueOnce(null);

    await expect(
      transferLeadership(CLAN_ID, OTHER_USER_ID, USER_ID)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("swaps roles in a transaction on success", async () => {
    mockClanMemberFindUnique
      .mockResolvedValueOnce({ userId: USER_ID, clanId: CLAN_ID, role: "LEADER" })
      .mockResolvedValueOnce({ userId: OTHER_USER_ID, clanId: CLAN_ID, role: "MEMBER" });

    await transferLeadership(CLAN_ID, OTHER_USER_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
  });
});

describe("switchClan", () => {
  beforeEach(() => {
    // Default: target clan exists, no joinRequestsEnabled
    mockClanFindUnique.mockResolvedValue({
      id: TARGET_CLAN_ID,
      settings: {},
    });
  });

  it("throws NOT_FOUND if user is not in current clan", async () => {
    mockClanMemberFindUnique.mockResolvedValue(null);

    await expect(
      switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("switches for a regular member (direct join)", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "MEMBER",
    });

    const result = await switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
    expect(result).toEqual({ joined: true, requestCreated: false });
  });

  it("creates join request when target has joinRequestsEnabled", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "MEMBER",
    });
    mockClanFindUnique.mockResolvedValue({
      id: TARGET_CLAN_ID,
      settings: { joinRequestsEnabled: true },
    });

    const result = await switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
    expect(result).toEqual({ joined: false, requestCreated: true });
  });

  it("dissolves + joins for a solo leader", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "LEADER",
    });
    mockClanMemberCount.mockResolvedValue(1);

    const result = await switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
    expect(result).toEqual({ joined: true, requestCreated: false });
  });

  it("solo leader dissolves + creates request when target requires it", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "LEADER",
    });
    mockClanMemberCount.mockResolvedValue(1);
    mockClanFindUnique.mockResolvedValue({
      id: TARGET_CLAN_ID,
      settings: { joinRequestsEnabled: true },
    });

    const result = await switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID);
    expect(mockTransaction).toHaveBeenCalled();
    expect(result).toEqual({ joined: false, requestCreated: true });
  });

  it("throws LEADER_MUST_TRANSFER for leader with multiple members", async () => {
    mockClanMemberFindUnique.mockResolvedValue({
      userId: USER_ID,
      clanId: CLAN_ID,
      role: "LEADER",
    });
    mockClanMemberCount.mockResolvedValue(3);

    await expect(
      switchClan(CLAN_ID, TARGET_CLAN_ID, USER_ID)
    ).rejects.toMatchObject({ code: "LEADER_MUST_TRANSFER" });
  });
});
