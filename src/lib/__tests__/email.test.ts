import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer before importing email module
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe("email", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockSendMail.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("sendVerificationEmail", () => {
    it("includes from field when SMTP is configured", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "pass";
      process.env.EMAIL_FROM = "Test <noreply@test.com>";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token123");

      expect(mockSendMail).toHaveBeenCalledOnce();
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("Test <noreply@test.com>");
      expect(callArgs.to).toBe("user@example.com");
      expect(callArgs.subject).toBe("Verify your ClanTrader account");
      expect(callArgs.html).toContain("https://example.com/verify-email?token=token123");
    });

    it("uses default from when EMAIL_FROM is not set", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "pass";
      delete process.env.EMAIL_FROM;

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token123");

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("ClanTrader <noreply@clantrader.com>");
    });

    it("logs to console when SMTP is not configured", async () => {
      delete process.env.SMTP_HOST;
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token123");

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith("\n=== DEV EMAIL ===");
      expect(consoleSpy).toHaveBeenCalledWith("From:", expect.any(String));
      expect(consoleSpy).toHaveBeenCalledWith("To:", "user@example.com");
      consoleSpy.mockRestore();
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("includes from field when SMTP is configured", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "pass";
      process.env.EMAIL_FROM = "Test <noreply@test.com>";
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "reset-token");

      expect(mockSendMail).toHaveBeenCalledOnce();
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe("Test <noreply@test.com>");
      expect(callArgs.to).toBe("user@example.com");
      expect(callArgs.subject).toBe("Reset your ClanTrader password");
      expect(callArgs.html).toContain("https://example.com/reset-password?token=reset-token");
    });
  });

  describe("transporter config", () => {
    it("uses secure: true for port 465", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "pass";

      const nodemailer = await import("nodemailer");
      vi.resetModules();

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token");

      const createTransport = nodemailer.default.createTransport;
      const lastCall = vi.mocked(createTransport).mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastCall?.secure).toBe(true);
      expect(lastCall?.port).toBe(465);
    });

    it("uses secure: false for port 587", async () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user@test.com";
      process.env.SMTP_PASS = "pass";

      const nodemailer = await import("nodemailer");
      vi.resetModules();

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token");

      const createTransport = nodemailer.default.createTransport;
      const lastCall = vi.mocked(createTransport).mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(lastCall?.secure).toBe(false);
      expect(lastCall?.port).toBe(587);
    });
  });
});
