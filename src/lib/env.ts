import { z } from "zod";

const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "Database connection string is required"),

  // Auth
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  // Email (optional — falls back to console logging in dev)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("ClanTrader"),

  // Upload
  UPLOAD_DIR: z.string().default("public/uploads"),
  MAX_AVATAR_SIZE_MB: z.coerce.number().positive().default(5),

  // SMS (optional)
  KAVENEGAR_API_KEY: z.string().optional(),
  KAVENEGAR_OTP_TEMPLATE: z.string().optional(),

  // Forex market hours (optional)
  FOREX_WEEKEND_START_UTC: z.string().optional(),
  FOREX_WEEKEND_END_UTC: z.string().optional(),

  // Testing (optional)
  TEST_WORKER_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SHOW_DEV_LOGIN: z.string().optional(),

  // Error tracking (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // Telegram notifications (optional)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export function validateEnv() {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const lines = Object.entries(errors).map(
      ([key, msgs]) => `  - ${key}: ${msgs?.join(", ")}`
    );
    console.error("\n❌ Invalid environment variables:\n" + lines.join("\n") + "\n");
    process.exit(1);
  }

  return result.data;
}

export type ServerEnv = ReturnType<typeof validateEnv>;
