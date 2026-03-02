import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockCount = vi.fn();
const mockClanMemberFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    message: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    clanMember: {
      findUnique: (...args: unknown[]) => mockClanMemberFindUnique(...args),
    },
  },
}));

import {
  requireClanMembership,
  createMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  getMessages,
  pinMessage,
  unpinMessage,
  MessageServiceError,
} from "@/services/message.service";
import { MESSAGES_PER_PAGE, MAX_PINNED_MESSAGES } from "@/lib/chat-constants";

// Helpers
const CLAN_ID = "clan-1";
const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const TOPIC_ID = "topic-1";
const MSG_ID = "msg-1";

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    clanId: CLAN_ID,
    role: "MEMBER",
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: MSG_ID,
    clanId: CLAN_ID,
    userId: USER_ID,
    topicId: TOPIC_ID,
    content: "Hello world",
    type: "TEXT",
    isPinned: false,
    isEdited: false,
    reactions: {},
    createdAt: new Date("2026-01-15T12:00:00Z"),
    ...overrides,
  };
}

describe("message.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // requireClanMembership
  // ---------------------------------------------------------------------------
  describe("requireClanMembership", () => {
    it("returns membership when found", async () => {
      const membership = makeMembership();
      mockClanMemberFindUnique.mockResolvedValue(membership);

      const result = await requireClanMembership(USER_ID, CLAN_ID);

      expect(result).toEqual(membership);
      expect(mockClanMemberFindUnique).toHaveBeenCalledWith({
        where: { userId_clanId: { userId: USER_ID, clanId: CLAN_ID } },
      });
    });

    it("throws NOT_MEMBER (403) when not found", async () => {
      mockClanMemberFindUnique.mockResolvedValue(null);

      await expect(requireClanMembership(USER_ID, CLAN_ID)).rejects.toThrow(
        MessageServiceError
      );

      try {
        await requireClanMembership(USER_ID, CLAN_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("NOT_MEMBER");
        expect(e.status).toBe(403);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // createMessage
  // ---------------------------------------------------------------------------
  describe("createMessage", () => {
    it("creates basic text message", async () => {
      const created = makeMessage();
      mockCreate.mockResolvedValue(created);

      const result = await createMessage(CLAN_ID, USER_ID, "Hello world", TOPIC_ID);

      expect(result).toEqual(created);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clanId: CLAN_ID,
            userId: USER_ID,
            content: "Hello world",
            topicId: TOPIC_ID,
            type: "TEXT",
          }),
        })
      );
    });

    it("creates with replyToId", async () => {
      const created = makeMessage({ replyToId: "reply-msg-1" });
      mockCreate.mockResolvedValue(created);

      await createMessage(CLAN_ID, USER_ID, "Reply text", TOPIC_ID, {
        replyToId: "reply-msg-1",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            replyToId: "reply-msg-1",
          }),
        })
      );
    });

    it("creates with images", async () => {
      const images = ["https://img.example.com/a.png", "https://img.example.com/b.png"];
      const created = makeMessage({ images });
      mockCreate.mockResolvedValue(created);

      await createMessage(CLAN_ID, USER_ID, "Check these out", TOPIC_ID, { images });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images,
          }),
        })
      );
    });

    it("creates with custom type", async () => {
      const created = makeMessage({ type: "TRADE_CARD" });
      mockCreate.mockResolvedValue(created);

      await createMessage(CLAN_ID, USER_ID, "Signal content", TOPIC_ID, {
        type: "TRADE_CARD" as never,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "TRADE_CARD",
          }),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // editMessage
  // ---------------------------------------------------------------------------
  describe("editMessage", () => {
    it("edits own message successfully (sets isEdited: true)", async () => {
      const msg = makeMessage();
      mockFindUnique.mockResolvedValue(msg);
      const updated = { ...msg, content: "Edited text", isEdited: true };
      mockUpdate.mockResolvedValue(updated);

      const result = await editMessage(MSG_ID, CLAN_ID, USER_ID, "Edited text");

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: { content: "Edited text", isEdited: true },
        })
      );
    });

    it("throws NOT_FOUND when message doesn't exist", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        editMessage("nonexistent", CLAN_ID, USER_ID, "text")
      ).rejects.toThrow(MessageServiceError);

      try {
        await editMessage("nonexistent", CLAN_ID, USER_ID, "text");
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("NOT_FOUND");
        expect(e.status).toBe(404);
      }
    });

    it("throws NOT_FOUND when clanId doesn't match", async () => {
      mockFindUnique.mockResolvedValue(makeMessage({ clanId: "other-clan" }));

      await expect(
        editMessage(MSG_ID, CLAN_ID, USER_ID, "text")
      ).rejects.toThrow(MessageServiceError);

      try {
        await editMessage(MSG_ID, CLAN_ID, USER_ID, "text");
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("NOT_FOUND");
        expect(e.status).toBe(404);
      }
    });

    it("throws FORBIDDEN when editing another user's message", async () => {
      mockFindUnique.mockResolvedValue(makeMessage({ userId: OTHER_USER_ID }));

      await expect(
        editMessage(MSG_ID, CLAN_ID, USER_ID, "text")
      ).rejects.toThrow(MessageServiceError);

      try {
        await editMessage(MSG_ID, CLAN_ID, USER_ID, "text");
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("FORBIDDEN");
        expect(e.status).toBe(403);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // deleteMessage
  // ---------------------------------------------------------------------------
  describe("deleteMessage", () => {
    it("deletes own message", async () => {
      const msg = makeMessage();
      mockFindUnique.mockResolvedValue(msg);
      mockDelete.mockResolvedValue(msg);

      const result = await deleteMessage(MSG_ID, CLAN_ID, USER_ID);

      expect(result).toEqual(msg);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: MSG_ID } });
    });

    it("leader can delete any message", async () => {
      const msg = makeMessage({ userId: OTHER_USER_ID });
      mockFindUnique.mockResolvedValue(msg);
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "LEADER" })
      );
      mockDelete.mockResolvedValue(msg);

      const result = await deleteMessage(MSG_ID, CLAN_ID, USER_ID);

      expect(result).toEqual(msg);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: MSG_ID } });
    });

    it("CO_LEADER can delete any message", async () => {
      const msg = makeMessage({ userId: OTHER_USER_ID });
      mockFindUnique.mockResolvedValue(msg);
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "CO_LEADER" })
      );
      mockDelete.mockResolvedValue(msg);

      const result = await deleteMessage(MSG_ID, CLAN_ID, USER_ID);

      expect(result).toEqual(msg);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: MSG_ID } });
    });

    it("regular member cannot delete others' messages (FORBIDDEN)", async () => {
      const msg = makeMessage({ userId: OTHER_USER_ID });
      mockFindUnique.mockResolvedValue(msg);
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "MEMBER" })
      );

      await expect(
        deleteMessage(MSG_ID, CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        mockFindUnique.mockResolvedValue(msg);
        mockClanMemberFindUnique.mockResolvedValue(
          makeMembership({ role: "MEMBER" })
        );
        await deleteMessage(MSG_ID, CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("FORBIDDEN");
        expect(e.status).toBe(403);
      }
    });

    it("throws NOT_FOUND for missing message", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        deleteMessage("nonexistent", CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        await deleteMessage("nonexistent", CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("NOT_FOUND");
        expect(e.status).toBe(404);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // toggleReaction
  // ---------------------------------------------------------------------------
  describe("toggleReaction", () => {
    it("adds emoji when not present", async () => {
      const msg = makeMessage({ reactions: {} });
      mockFindUnique.mockResolvedValue(msg);
      const updated = makeMessage({ reactions: { "👍": [USER_ID] } });
      mockUpdate.mockResolvedValue(updated);

      const result = await toggleReaction(MSG_ID, CLAN_ID, USER_ID, "👍");

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: { reactions: { "👍": [USER_ID] } },
        })
      );
    });

    it("removes emoji when already present (toggle off)", async () => {
      const msg = makeMessage({ reactions: { "👍": [USER_ID] } });
      mockFindUnique.mockResolvedValue(msg);
      const updated = makeMessage({ reactions: {} });
      mockUpdate.mockResolvedValue(updated);

      const result = await toggleReaction(MSG_ID, CLAN_ID, USER_ID, "👍");

      expect(result).toEqual(updated);
      // When last user removes reaction, the emoji key should be deleted
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: { reactions: {} },
        })
      );
    });

    it("handles multiple emojis on same message", async () => {
      const msg = makeMessage({
        reactions: { "👍": [OTHER_USER_ID], "🔥": [USER_ID] },
      });
      mockFindUnique.mockResolvedValue(msg);
      const updated = makeMessage({
        reactions: {
          "👍": [OTHER_USER_ID, USER_ID],
          "🔥": [USER_ID],
        },
      });
      mockUpdate.mockResolvedValue(updated);

      await toggleReaction(MSG_ID, CLAN_ID, USER_ID, "👍");

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reactions: {
              "👍": [OTHER_USER_ID, USER_ID],
              "🔥": [USER_ID],
            },
          },
        })
      );
    });

    it("throws NOT_FOUND for missing message", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        toggleReaction("nonexistent", CLAN_ID, USER_ID, "👍")
      ).rejects.toThrow(MessageServiceError);

      try {
        await toggleReaction("nonexistent", CLAN_ID, USER_ID, "👍");
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("NOT_FOUND");
        expect(e.status).toBe(404);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getMessages
  // ---------------------------------------------------------------------------
  describe("getMessages", () => {
    it("returns messages with hasMore=false when fewer than limit", async () => {
      const messages = [makeMessage({ id: "msg-1" }), makeMessage({ id: "msg-2" })];
      mockFindMany.mockResolvedValue(messages);

      const result = await getMessages(CLAN_ID, TOPIC_ID);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.messages).toHaveLength(2);
      // findMany should request limit+1 items (MESSAGES_PER_PAGE + 1)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: MESSAGES_PER_PAGE + 1,
          where: expect.objectContaining({ clanId: CLAN_ID, topicId: TOPIC_ID }),
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("returns messages with hasMore=true and nextCursor when more exist", async () => {
      // Return limit+1 messages to indicate there are more
      const messages = Array.from({ length: MESSAGES_PER_PAGE + 1 }, (_, i) =>
        makeMessage({ id: `msg-${i}` })
      );
      mockFindMany.mockResolvedValue(messages);

      const result = await getMessages(CLAN_ID, TOPIC_ID);

      expect(result.hasMore).toBe(true);
      // After pop() and reverse(), first element is at index MESSAGES_PER_PAGE - 1 (reversed)
      expect(result.nextCursor).toBeDefined();
      expect(result.messages).toHaveLength(MESSAGES_PER_PAGE);
    });

    it("uses cursor for pagination (looks up createdAt first)", async () => {
      const cursorDate = new Date("2026-01-15T11:00:00Z");
      // First call: cursor message lookup
      mockFindUnique.mockResolvedValue({ createdAt: cursorDate });
      // Second call: actual messages
      mockFindMany.mockResolvedValue([makeMessage()]);

      await getMessages(CLAN_ID, TOPIC_ID, { cursor: "cursor-msg-id" });

      // Should look up cursor message first
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "cursor-msg-id" },
        select: { createdAt: true },
      });

      // Should use lt: cursorDate in findMany
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clanId: CLAN_ID,
            topicId: TOPIC_ID,
            createdAt: { lt: cursorDate },
          }),
        })
      );
    });

    it("respects limit cap (max 100)", async () => {
      mockFindMany.mockResolvedValue([]);

      await getMessages(CLAN_ID, TOPIC_ID, { limit: 500 });

      // Capped to 100, so take = 101
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101,
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // pinMessage
  // ---------------------------------------------------------------------------
  describe("pinMessage", () => {
    it("leader can pin", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "LEADER" })
      );
      const msg = makeMessage();
      mockFindUnique.mockResolvedValue(msg);
      mockCount.mockResolvedValue(0);
      const pinned = { ...msg, isPinned: true };
      mockUpdate.mockResolvedValue(pinned);

      const result = await pinMessage(MSG_ID, CLAN_ID, USER_ID);

      expect(result).toEqual(pinned);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: { isPinned: true },
        })
      );
    });

    it("non-leader gets FORBIDDEN", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "MEMBER" })
      );

      await expect(
        pinMessage(MSG_ID, CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        mockClanMemberFindUnique.mockResolvedValue(
          makeMembership({ role: "MEMBER" })
        );
        await pinMessage(MSG_ID, CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("FORBIDDEN");
        expect(e.status).toBe(403);
      }
    });

    it("already pinned gets ALREADY_PINNED (409)", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "LEADER" })
      );
      mockFindUnique.mockResolvedValue(makeMessage({ isPinned: true }));

      await expect(
        pinMessage(MSG_ID, CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        mockClanMemberFindUnique.mockResolvedValue(
          makeMembership({ role: "LEADER" })
        );
        mockFindUnique.mockResolvedValue(makeMessage({ isPinned: true }));
        await pinMessage(MSG_ID, CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("ALREADY_PINNED");
        expect(e.status).toBe(409);
      }
    });

    it("exceeding limit gets PIN_LIMIT (400)", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "LEADER" })
      );
      mockFindUnique.mockResolvedValue(makeMessage());
      mockCount.mockResolvedValue(MAX_PINNED_MESSAGES);

      await expect(
        pinMessage(MSG_ID, CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        mockClanMemberFindUnique.mockResolvedValue(
          makeMembership({ role: "LEADER" })
        );
        mockFindUnique.mockResolvedValue(makeMessage());
        mockCount.mockResolvedValue(MAX_PINNED_MESSAGES);
        await pinMessage(MSG_ID, CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("PIN_LIMIT");
        expect(e.status).toBe(400);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // unpinMessage
  // ---------------------------------------------------------------------------
  describe("unpinMessage", () => {
    it("leader can unpin", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "LEADER" })
      );
      const msg = makeMessage({ isPinned: true });
      mockFindUnique.mockResolvedValue(msg);
      const unpinned = { ...msg, isPinned: false };
      mockUpdate.mockResolvedValue(unpinned);

      const result = await unpinMessage(MSG_ID, CLAN_ID, USER_ID);

      expect(result).toEqual(unpinned);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MSG_ID },
          data: { isPinned: false },
        })
      );
    });

    it("non-leader gets FORBIDDEN", async () => {
      mockClanMemberFindUnique.mockResolvedValue(
        makeMembership({ role: "MEMBER" })
      );

      await expect(
        unpinMessage(MSG_ID, CLAN_ID, USER_ID)
      ).rejects.toThrow(MessageServiceError);

      try {
        mockClanMemberFindUnique.mockResolvedValue(
          makeMembership({ role: "MEMBER" })
        );
        await unpinMessage(MSG_ID, CLAN_ID, USER_ID);
      } catch (err) {
        const e = err as MessageServiceError;
        expect(e.code).toBe("FORBIDDEN");
        expect(e.status).toBe(403);
      }
    });
  });
});
