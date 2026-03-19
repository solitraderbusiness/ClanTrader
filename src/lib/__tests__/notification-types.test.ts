import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TYPES,
  SEVERITY_MAP,
  FAMILY_MAP,
  PUSH_CATEGORY_MAP,
  COOLDOWN_SECONDS,
} from "../notification-types";

// Derive the full set of notification type values once, used across coverage tests
const ALL_TYPES = Object.values(NOTIFICATION_TYPES) as string[];

// ---- SEVERITY_MAP ----

describe("SEVERITY_MAP", () => {
  it("maps PRICE_ALERT_TRIGGERED to IMPORTANT (not CRITICAL)", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).toBe("IMPORTANT");
  });

  it("maps RISK_NO_SL to CRITICAL", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.RISK_NO_SL]).toBe("CRITICAL");
  });

  it("maps RISK_DRAWDOWN to CRITICAL", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.RISK_DRAWDOWN]).toBe("CRITICAL");
  });

  it("maps TRADE_ACTION_FAILED to CRITICAL", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRADE_ACTION_FAILED]).toBe("CRITICAL");
  });

  it("maps TRACKING_LOST to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRACKING_LOST]).toBe("IMPORTANT");
  });

  it("maps TRACKING_RESTORED to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRACKING_RESTORED]).toBe("IMPORTANT");
  });

  it("maps TRACKING_PROVISIONAL to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRACKING_PROVISIONAL]).toBe("IMPORTANT");
  });

  it("maps INTEGRITY_LOST to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.INTEGRITY_LOST]).toBe("IMPORTANT");
  });

  it("maps QUALIFICATION_MISSED to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.QUALIFICATION_MISSED]).toBe("IMPORTANT");
  });

  it("maps RANK_CHANGE to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.RANK_CHANGE]).toBe("IMPORTANT");
  });

  it("maps EVENT_REMINDER to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.EVENT_REMINDER]).toBe("IMPORTANT");
  });

  it("maps CLAN_JOIN_REQUEST to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_REQUEST]).toBe("IMPORTANT");
  });

  it("maps CLAN_JOIN_APPROVED to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_APPROVED]).toBe("IMPORTANT");
  });

  it("maps CLAN_JOIN_REJECTED to IMPORTANT", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_REJECTED]).toBe("IMPORTANT");
  });

  it("maps TRADE_CLOSED to UPDATE", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRADE_CLOSED]).toBe("UPDATE");
  });

  it("maps TRADE_ACTION_SUCCESS to UPDATE", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.TRADE_ACTION_SUCCESS]).toBe("UPDATE");
  });

  it("maps PRICE_ALERT_EXPIRED to UPDATE", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_EXPIRED]).toBe("UPDATE");
  });

  it("maps CLAN_MEMBER_JOINED to UPDATE", () => {
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.CLAN_MEMBER_JOINED]).toBe("UPDATE");
  });

  it("has a mapping for every notification type (no gaps)", () => {
    for (const type of ALL_TYPES) {
      expect(
        SEVERITY_MAP[type as keyof typeof SEVERITY_MAP],
        `SEVERITY_MAP missing entry for "${type}"`
      ).toBeDefined();
    }
  });

  it("only uses valid severity values", () => {
    const validSeverities = new Set(["CRITICAL", "IMPORTANT", "UPDATE"]);
    for (const [type, severity] of Object.entries(SEVERITY_MAP)) {
      expect(
        validSeverities.has(severity),
        `SEVERITY_MAP["${type}"] has unknown value "${severity}"`
      ).toBe(true);
    }
  });
});

// ---- FAMILY_MAP ----

describe("FAMILY_MAP", () => {
  it("maps PRICE_ALERT_TRIGGERED to MARKET", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).toBe("MARKET");
  });

  it("maps PRICE_ALERT_EXPIRED to MARKET", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_EXPIRED]).toBe("MARKET");
  });

  it("maps EVENT_REMINDER to MARKET", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.EVENT_REMINDER]).toBe("MARKET");
  });

  it("maps RISK_NO_SL to ACCOUNT", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.RISK_NO_SL]).toBe("ACCOUNT");
  });

  it("maps RISK_DRAWDOWN to ACCOUNT", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.RISK_DRAWDOWN]).toBe("ACCOUNT");
  });

  it("maps TRACKING_LOST to ACCOUNT", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.TRACKING_LOST]).toBe("ACCOUNT");
  });

  it("maps TRADE_CLOSED to ACCOUNT", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.TRADE_CLOSED]).toBe("ACCOUNT");
  });

  it("maps RANK_CHANGE to CLAN", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.RANK_CHANGE]).toBe("CLAN");
  });

  it("maps CLAN_JOIN_REQUEST to CLAN", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_REQUEST]).toBe("CLAN");
  });

  it("maps CLAN_MEMBER_JOINED to CLAN", () => {
    expect(FAMILY_MAP[NOTIFICATION_TYPES.CLAN_MEMBER_JOINED]).toBe("CLAN");
  });

  it("has a mapping for every notification type (no gaps)", () => {
    for (const type of ALL_TYPES) {
      expect(
        FAMILY_MAP[type as keyof typeof FAMILY_MAP],
        `FAMILY_MAP missing entry for "${type}"`
      ).toBeDefined();
    }
  });

  it("only uses valid family values", () => {
    const validFamilies = new Set(["ACCOUNT", "MARKET", "CLAN", "SYSTEM"]);
    for (const [type, family] of Object.entries(FAMILY_MAP)) {
      expect(
        validFamilies.has(family),
        `FAMILY_MAP["${type}"] has unknown value "${family}"`
      ).toBe(true);
    }
  });
});

// ---- PUSH_CATEGORY_MAP ----

describe("PUSH_CATEGORY_MAP", () => {
  it("maps PRICE_ALERT_TRIGGERED to price_alerts category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).toBe("price_alerts");
  });

  it("maps PRICE_ALERT_EXPIRED to price_alerts category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_EXPIRED]).toBe("price_alerts");
  });

  it("maps EVENT_REMINDER to price_alerts category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.EVENT_REMINDER]).toBe("price_alerts");
  });

  it("maps RISK_NO_SL to risk category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.RISK_NO_SL]).toBe("risk");
  });

  it("maps RISK_DRAWDOWN to risk category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.RISK_DRAWDOWN]).toBe("risk");
  });

  it("maps TRACKING_LOST to tracking category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRACKING_LOST]).toBe("tracking");
  });

  it("maps TRACKING_RESTORED to tracking category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRACKING_RESTORED]).toBe("tracking");
  });

  it("maps TRACKING_PROVISIONAL to tracking category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRACKING_PROVISIONAL]).toBe("tracking");
  });

  it("maps INTEGRITY_LOST to integrity category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.INTEGRITY_LOST]).toBe("integrity");
  });

  it("maps QUALIFICATION_MISSED to integrity category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.QUALIFICATION_MISSED]).toBe("integrity");
  });

  it("maps TRADE_CLOSED to trades category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRADE_CLOSED]).toBe("trades");
  });

  it("maps TRADE_ACTION_SUCCESS to trades category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRADE_ACTION_SUCCESS]).toBe("trades");
  });

  it("maps TRADE_ACTION_FAILED to trades category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.TRADE_ACTION_FAILED]).toBe("trades");
  });

  it("maps RANK_CHANGE to clan category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.RANK_CHANGE]).toBe("clan");
  });

  it("maps CLAN_JOIN_REQUEST to clan category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_REQUEST]).toBe("clan");
  });

  it("maps CLAN_MEMBER_JOINED to clan category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.CLAN_MEMBER_JOINED]).toBe("clan");
  });

  it("maps CLAN_JOIN_APPROVED to clan category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_APPROVED]).toBe("clan");
  });

  it("maps CLAN_JOIN_REJECTED to clan category", () => {
    expect(PUSH_CATEGORY_MAP[NOTIFICATION_TYPES.CLAN_JOIN_REJECTED]).toBe("clan");
  });

  it("has a mapping for every notification type (no gaps)", () => {
    for (const type of ALL_TYPES) {
      expect(
        PUSH_CATEGORY_MAP[type as keyof typeof PUSH_CATEGORY_MAP],
        `PUSH_CATEGORY_MAP missing entry for "${type}"`
      ).toBeDefined();
    }
  });

  it("only uses valid push category values", () => {
    const validCategories = new Set(["trades", "price_alerts", "risk", "tracking", "integrity", "clan"]);
    for (const [type, category] of Object.entries(PUSH_CATEGORY_MAP)) {
      expect(
        validCategories.has(category),
        `PUSH_CATEGORY_MAP["${type}"] has unknown value "${category}"`
      ).toBe(true);
    }
  });
});

// ---- COOLDOWN_SECONDS ----

describe("COOLDOWN_SECONDS", () => {
  it("rate-limits TRACKING_LOST with a 1-hour cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRACKING_LOST]).toBe(3600);
  });

  it("rate-limits TRACKING_RESTORED with a 1-hour cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRACKING_RESTORED]).toBe(3600);
  });

  it("rate-limits TRACKING_PROVISIONAL with a 1-hour cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRACKING_PROVISIONAL]).toBe(3600);
  });

  it("rate-limits RISK_NO_SL with a 1-hour cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.RISK_NO_SL]).toBe(3600);
  });

  it("rate-limits RISK_DRAWDOWN with a 30-minute cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.RISK_DRAWDOWN]).toBe(1800);
  });

  it("rate-limits RANK_CHANGE with a 1-hour cooldown", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.RANK_CHANGE]).toBe(3600);
  });

  it("does NOT rate-limit PRICE_ALERT_TRIGGERED (each alert fires at most once)", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).toBeUndefined();
  });

  it("does NOT rate-limit TRADE_CLOSED (every close is a distinct, intentional event)", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRADE_CLOSED]).toBeUndefined();
  });

  it("does NOT rate-limit TRADE_ACTION_SUCCESS", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRADE_ACTION_SUCCESS]).toBeUndefined();
  });

  it("does NOT rate-limit TRADE_ACTION_FAILED", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.TRADE_ACTION_FAILED]).toBeUndefined();
  });

  it("does NOT rate-limit INTEGRITY_LOST", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.INTEGRITY_LOST]).toBeUndefined();
  });

  it("does NOT rate-limit CLAN_JOIN_REQUEST", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.CLAN_JOIN_REQUEST]).toBeUndefined();
  });

  it("does NOT rate-limit CLAN_JOIN_APPROVED", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.CLAN_JOIN_APPROVED]).toBeUndefined();
  });

  it("does NOT rate-limit CLAN_JOIN_REJECTED", () => {
    expect(COOLDOWN_SECONDS[NOTIFICATION_TYPES.CLAN_JOIN_REJECTED]).toBeUndefined();
  });

  it("all cooldown values are positive integers (no zero or negative durations)", () => {
    for (const [type, seconds] of Object.entries(COOLDOWN_SECONDS)) {
      expect(
        Number.isInteger(seconds) && (seconds as number) > 0,
        `COOLDOWN_SECONDS["${type}"] must be a positive integer, got ${seconds}`
      ).toBe(true);
    }
  });

  it("rate-limits only noisy recurring events, not one-shot or user-initiated ones", () => {
    // The set of rate-limited types should be exactly these recurring system events
    const rateLimitedTypes = Object.keys(COOLDOWN_SECONDS);
    const expectedRateLimitedTypes = [
      NOTIFICATION_TYPES.TRACKING_LOST,
      NOTIFICATION_TYPES.TRACKING_RESTORED,
      NOTIFICATION_TYPES.TRACKING_PROVISIONAL,
      NOTIFICATION_TYPES.RISK_NO_SL,
      NOTIFICATION_TYPES.RISK_DRAWDOWN,
      NOTIFICATION_TYPES.RANK_CHANGE,
    ];
    expect(rateLimitedTypes.sort()).toEqual(expectedRateLimitedTypes.sort());
  });
});

// ---- Regression: PRICE_ALERT_TRIGGERED severity was changed from CRITICAL to IMPORTANT ----

describe("Regression: PRICE_ALERT_TRIGGERED severity", () => {
  it("is IMPORTANT — was incorrectly CRITICAL before the polish pass", () => {
    // This test guards against reverting the intentional change.
    // Price alerts are user-configured informational triggers, not system emergencies.
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).toBe("IMPORTANT");
    expect(SEVERITY_MAP[NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED]).not.toBe("CRITICAL");
  });
});
