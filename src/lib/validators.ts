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

// --- Channel Post schemas ---

export const createChannelPostSchema = z.object({
  title: z
    .string()
    .max(200, "Title must be at most 200 characters")
    .optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content must be at most 5000 characters"),
  images: z.array(z.string()).max(4).optional(),
  isPremium: z.boolean().optional(),
});

export type CreateChannelPostInput = z.infer<typeof createChannelPostSchema>;

export const updateChannelPostSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(5000).optional(),
  isPremium: z.boolean().optional(),
});

export type UpdateChannelPostInput = z.infer<typeof updateChannelPostSchema>;

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

export type ReactionInput = z.infer<typeof reactionSchema>;

// --- Chat/Message schemas ---

export const sendMessageSchema = z.object({
  clanId: z.string().min(1),
  topicId: z.string().min(1),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters"),
  replyToId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  messageId: z.string().min(1),
  clanId: z.string().min(1),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters"),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const deleteMessageSchema = z.object({
  messageId: z.string().min(1),
  clanId: z.string().min(1),
});

export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;

export const pinMessageSchema = z.object({
  messageId: z.string().min(1),
  clanId: z.string().min(1),
});

export type PinMessageInput = z.infer<typeof pinMessageSchema>;

export const reactMessageSchema = z.object({
  messageId: z.string().min(1),
  clanId: z.string().min(1),
  emoji: z.string().min(1).max(8),
});

export type ReactMessageInput = z.infer<typeof reactMessageSchema>;

// --- Topic schemas ---

export const createTopicSchema = z.object({
  name: z
    .string()
    .min(2, "Topic name must be at least 2 characters")
    .max(30, "Topic name must be at most 30 characters"),
  description: z.string().max(200).optional(),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z.object({
  name: z
    .string()
    .min(2, "Topic name must be at least 2 characters")
    .max(30, "Topic name must be at most 30 characters")
    .optional(),
  description: z.string().max(200).optional().nullable(),
});

export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

// --- Trade Card schemas ---

export const sendTradeCardSchema = z.object({
  clanId: z.string().min(1),
  topicId: z.string().min(1),
  instrument: z.string().min(1).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  entry: z.number().positive(),
  stopLoss: z.number().positive(),
  targets: z.array(z.number().positive()).min(1).max(5),
  timeframe: z.string().min(1).max(10),
  riskPct: z.number().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(5).optional(),
});

export type SendTradeCardInput = z.infer<typeof sendTradeCardSchema>;

export const editTradeCardSchema = z.object({
  messageId: z.string().min(1),
  clanId: z.string().min(1),
  instrument: z.string().min(1).max(20),
  direction: z.enum(["LONG", "SHORT"]),
  entry: z.number().positive(),
  stopLoss: z.number().positive(),
  targets: z.array(z.number().positive()).min(1).max(5),
  timeframe: z.string().min(1).max(10),
  riskPct: z.number().min(0).max(100).optional(),
  note: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(5).optional(),
});

export type EditTradeCardInput = z.infer<typeof editTradeCardSchema>;

export const updateTradeStatusSchema = z.object({
  tradeId: z.string().min(1),
  clanId: z.string().min(1),
  status: z.enum(["OPEN", "TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED"]),
  note: z.string().max(500).optional(),
});

export type UpdateTradeStatusInput = z.infer<typeof updateTradeStatusSchema>;

// --- Admin schemas ---

export const featureFlagSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z_]+$/, "Key must be lowercase with underscores"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FeatureFlagInput = z.infer<typeof featureFlagSchema>;

export const updateFeatureFlagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;

export const paywallRuleSchema = z.object({
  resourceType: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  freePreview: z.record(z.string(), z.boolean()).optional(),
  enabled: z.boolean().optional(),
});

export type PaywallRuleInput = z.infer<typeof paywallRuleSchema>;

export const updatePaywallRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  freePreview: z.record(z.string(), z.boolean()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdatePaywallRuleInput = z.infer<typeof updatePaywallRuleSchema>;

export const planSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
  description: z.string().max(500).optional(),
  price: z.number().min(0),
  currency: z.string().max(10).optional(),
  interval: z.string().max(20).optional(),
  entitlements: z.array(z.string()),
  sortOrder: z.number().int().optional(),
});

export type PlanInput = z.infer<typeof planSchema>;

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  interval: z.string().max(20).optional(),
  entitlements: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

// --- Clan Settings schemas ---

export const clanSettingsSchema = z.object({
  publicTags: z.array(z.string().max(30)).max(10).optional(),
  autoPostEnabled: z.boolean().optional(),
});

export type ClanSettingsInput = z.infer<typeof clanSettingsSchema>;

// --- Trade Action schemas ---

export const tradeActionSchema = z.object({
  tradeId: z.string().min(1),
  clanId: z.string().min(1),
  actionType: z.enum(["SET_BE", "MOVE_SL", "CHANGE_TP", "CLOSE", "ADD_NOTE", "STATUS_CHANGE"]),
  newValue: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type TradeActionInput = z.infer<typeof tradeActionSchema>;

// --- Watchlist schemas ---

export const addWatchlistItemSchema = z.object({
  instrument: z.string().min(1).max(20),
});

export type AddWatchlistItemInput = z.infer<typeof addWatchlistItemSchema>;

// --- Summary schemas ---

export const generateSummarySchema = z.object({
  hours: z.number().int().min(1).max(168).optional(),
  cardCount: z.number().int().min(1).max(100).optional(),
});

export type GenerateSummaryInput = z.infer<typeof generateSummarySchema>;
