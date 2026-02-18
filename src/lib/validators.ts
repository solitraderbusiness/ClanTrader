import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  tradingStyle: z.string().max(50).optional(),
  sessionPreference: z.string().max(50).optional(),
  preferredPairs: z.array(z.string()).max(10).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const statementReviewSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  reviewNotes: z.string().max(1000).optional(),
});

export type StatementReviewInput = z.infer<typeof statementReviewSchema>;

// --- Clan schemas ---

export const createClanSchema = z.object({
  name: z
    .string()
    .min(3, "Clan name must be at least 3 characters")
    .max(30, "Clan name must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9 -]*[a-zA-Z0-9]$/,
      "Clan name must start and end with alphanumeric characters and contain only letters, numbers, spaces, and hyphens"
    ),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  tradingFocus: z.string().max(50).optional(),
  isPublic: z.boolean(),
});

export type CreateClanInput = z.infer<typeof createClanSchema>;

export const updateClanSchema = createClanSchema.partial();

export type UpdateClanInput = z.infer<typeof updateClanSchema>;

export const createInviteSchema = z.object({
  expiresInHours: z.number().positive().optional(),
  maxUses: z.number().int().min(1).max(100).optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(["CO_LEADER", "MEMBER"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
