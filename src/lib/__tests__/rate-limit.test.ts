import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIncr, mockExpire, mockTtl } = vi.hoisted(() => ({
  mockIncr: vi.fn(),
  mockExpire: vi.fn(),
  mockTtl: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { incr: mockIncr, expire: mockExpire, ttl: mockTtl },
}));

import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rateLimit", () => {
    it("allows requests under the limit", async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      const result = await rateLimit("test:key", "AUTH_STRICT");
      expect(result).toBeNull();
      expect(mockIncr).toHaveBeenCalledWith("rl:test:key");
      expect(mockExpire).toHaveBeenCalledWith("rl:test:key", RATE_LIMITS.AUTH_STRICT.windowSec);
    });

    it("sets expire only on first increment", async () => {
      mockIncr.mockResolvedValue(3);

      const result = await rateLimit("test:key", "AUTH_STRICT");
      expect(result).toBeNull();
      expect(mockExpire).not.toHaveBeenCalled();
    });

    it("blocks requests over the limit with 429", async () => {
      mockIncr.mockResolvedValue(RATE_LIMITS.AUTH_STRICT.max + 1);
      mockTtl.mockResolvedValue(45);

      const result = await rateLimit("test:key", "AUTH_STRICT");
      expect(result).not.toBeNull();

      const body = await result!.json();
      expect(result!.status).toBe(429);
      expect(body.code).toBe("RATE_LIMITED");
      expect(result!.headers.get("Retry-After")).toBe("45");
      expect(result!.headers.get("X-RateLimit-Limit")).toBe(String(RATE_LIMITS.AUTH_STRICT.max));
      expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("allows at exactly the limit", async () => {
      mockIncr.mockResolvedValue(RATE_LIMITS.PUBLIC_READ.max);

      const result = await rateLimit("test:key", "PUBLIC_READ");
      expect(result).toBeNull();
    });

    it("blocks at limit + 1", async () => {
      mockIncr.mockResolvedValue(RATE_LIMITS.PUBLIC_READ.max + 1);
      mockTtl.mockResolvedValue(30);

      const result = await rateLimit("test:key", "PUBLIC_READ");
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });

    it("accepts custom config object", async () => {
      mockIncr.mockResolvedValue(4);
      mockTtl.mockResolvedValue(10);

      const result = await rateLimit("test:key", { max: 3, windowSec: 30 });
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });

    it("fails open when Redis errors", async () => {
      mockIncr.mockRejectedValue(new Error("Redis down"));

      const result = await rateLimit("test:key", "AUTH_STRICT");
      expect(result).toBeNull();
    });

    it("uses fallback TTL when Redis ttl returns -1", async () => {
      mockIncr.mockResolvedValue(100);
      mockTtl.mockResolvedValue(-1);

      const result = await rateLimit("test:key", "EA");
      expect(result).not.toBeNull();
      expect(result!.headers.get("Retry-After")).toBe(String(RATE_LIMITS.EA.windowSec));
    });

    it("uses different keys for different tiers", async () => {
      mockIncr.mockResolvedValue(1);
      mockExpire.mockResolvedValue(1);

      await rateLimit("auth:login:1.2.3.4", "AUTH_STRICT");
      expect(mockIncr).toHaveBeenCalledWith("rl:auth:login:1.2.3.4");

      await rateLimit("pub:explore:1.2.3.4", "PUBLIC_READ");
      expect(mockIncr).toHaveBeenCalledWith("rl:pub:explore:1.2.3.4");
    });
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("extracts IP from x-real-ip", () => {
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("prefers x-forwarded-for over x-real-ip", () => {
      const req = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "5.6.7.8",
        },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("returns unknown when no IP headers", () => {
      const req = new Request("http://localhost");
      expect(getClientIp(req)).toBe("unknown");
    });
  });

  describe("RATE_LIMITS tiers", () => {
    it("AUTH_STRICT is the most restrictive", () => {
      expect(RATE_LIMITS.AUTH_STRICT.max).toBeLessThanOrEqual(RATE_LIMITS.PUBLIC_READ.max);
      expect(RATE_LIMITS.AUTH_STRICT.max).toBeLessThanOrEqual(RATE_LIMITS.AUTHENTICATED.max);
    });

    it("UPLOAD is more restrictive than AUTHENTICATED", () => {
      expect(RATE_LIMITS.UPLOAD.max).toBeLessThanOrEqual(RATE_LIMITS.AUTHENTICATED.max);
    });

    it("all tiers have positive max and windowSec", () => {
      for (const [, config] of Object.entries(RATE_LIMITS)) {
        expect(config.max).toBeGreaterThan(0);
        expect(config.windowSec).toBeGreaterThan(0);
      }
    });
  });
});
