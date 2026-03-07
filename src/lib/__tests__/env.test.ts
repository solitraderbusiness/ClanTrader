import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the schema directly rather than calling validateEnv() (which calls process.exit)
import { z } from "zod";

// Re-create the schema here to test it in isolation
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "Database connection string is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("ClanTrader"),
  UPLOAD_DIR: z.string().default("public/uploads"),
  MAX_AVATAR_SIZE_MB: z.coerce.number().positive().default(5),
  KAVENEGAR_API_KEY: z.string().optional(),
  KAVENEGAR_OTP_TEMPLATE: z.string().optional(),
  FOREX_WEEKEND_START_UTC: z.string().optional(),
  FOREX_WEEKEND_END_UTC: z.string().optional(),
  TEST_WORKER_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SHOW_DEV_LOGIN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

describe("env validation", () => {
  it("passes with valid required env vars", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      AUTH_SECRET: "a-secret-that-is-long-enough-32chars",
    });
    expect(result.success).toBe(true);
  });

  it("fails when DATABASE_URL is missing", () => {
    const result = serverEnvSchema.safeParse({
      AUTH_SECRET: "a-secret-that-is-long-enough-32chars",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.DATABASE_URL).toBeDefined();
    }
  });

  it("fails when AUTH_SECRET is too short", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      AUTH_SECRET: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.AUTH_SECRET).toBeDefined();
    }
  });

  it("fails when AUTH_SECRET is missing", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      AUTH_SECRET: "a-secret-that-is-long-enough-32chars",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REDIS_URL).toBe("redis://localhost:6379");
      expect(result.data.SMTP_PORT).toBe(587);
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
      expect(result.data.NEXT_PUBLIC_APP_NAME).toBe("ClanTrader");
      expect(result.data.UPLOAD_DIR).toBe("public/uploads");
      expect(result.data.MAX_AVATAR_SIZE_MB).toBe(5);
    }
  });

  it("coerces SMTP_PORT from string to number", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      AUTH_SECRET: "a-secret-that-is-long-enough-32chars",
      SMTP_PORT: "465",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SMTP_PORT).toBe(465);
    }
  });

  it("rejects invalid NEXT_PUBLIC_APP_URL", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      AUTH_SECRET: "a-secret-that-is-long-enough-32chars",
      NEXT_PUBLIC_APP_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("reports multiple errors at once", () => {
    const result = serverEnvSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.DATABASE_URL).toBeDefined();
      expect(errors.AUTH_SECRET).toBeDefined();
    }
  });
});
