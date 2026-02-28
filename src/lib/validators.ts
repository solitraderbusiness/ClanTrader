import { z } from "zod";
import { RESERVED_USERNAMES } from "./reserved-usernames";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Username must start with a letter and contain only lowercase letters, numbers, and underscores"
  )
  .refine((val) => !RESERVED_USERNAMES.has(val), {
    message: "This username is reserved",
  });

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    username: usernameSchema,
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    ref: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// --- Phone OTP schemas ---

export const phoneSchema = z
  .string()
  .regex(/^09\d{9}$/, "Phone must be a valid Iranian mobile number (09xxxxxxxxx)");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  mode: z.enum(["login", "add-phone"]).optional(),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const phoneSignupSchema = z.object({
  token: z.string().min(1, "Token is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  username: usernameSchema,
  ref: z.string().optional(),
});

export type PhoneSignupInput = z.infer<typeof phoneSignupSchema>;

// --- EA (MetaTrader) schemas ---

export const eaRegisterSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  accountNumber: z.number().int().positive("Account number must be positive"),
  broker: z.string().min(1, "Broker is required").max(100),
  platform: z.enum(["MT4", "MT5"]),
  serverName: z.string().max(100).optional(),
});

export type EaRegisterInput = z.infer<typeof eaRegisterSchema>;

export const eaLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  accountNumber: z.number().int().positive("Account number must be positive"),
  broker: z.string().min(1, "Broker is required").max(100),
  platform: z.enum(["MT4", "MT5"]),
  serverName: z.string().max(100).optional(),
});

export type EaLoginInput = z.infer<typeof eaLoginSchema>;

export const mtTradeInputSchema = z.object({
  ticket: z.number().int().positive(),
  symbol: z.string().min(1).max(20),
  direction: z.enum(["BUY", "SELL"]),
  lots: z.number().positive(),
  openPrice: z.number().positive(),
  closePrice: z.number().optional(),
  openTime: z.string().datetime(),
  closeTime: z.string().datetime().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  profit: z.number().optional(),
  currentPrice: z.number().optional(),
  commission: z.number().optional(),
  swap: z.number().optional(),
  comment: z.string().max(200).optional(),
  magicNumber: z.number().int().optional(),
  isOpen: z.boolean(),
});

export type MtTradeInput = z.infer<typeof mtTradeInputSchema>;

export const eaHeartbeatSchema = z.object({
  balance: z.number(),
  equity: z.number(),
  margin: z.number().optional(),
  freeMargin: z.number().optional(),
  openTrades: z.array(mtTradeInputSchema).max(200).default([]),
});

export type EaHeartbeatInput = z.infer<typeof eaHeartbeatSchema>;

export const eaTradeSyncSchema = z.object({
  trades: z.array(mtTradeInputSchema).max(5000),
});

export type EaTradeSyncInput = z.infer<typeof eaTradeSyncSchema>;

export const eaTradeEventSchema = z.object({
  event: z.enum(["open", "close", "modify"]),
  trade: mtTradeInputSchema,
});

export type EaTradeEventInput = z.infer<typeof eaTradeEventSchema>;

export const addEmailSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AddEmailInput = z.infer<typeof addEmailSchema>;

export const addPhoneSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type AddPhoneInput = z.infer<typeof addPhoneSchema>;

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
  username: usernameSchema.optional(),
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
    .min(0)
    .max(2000, "Message must be at most 2000 characters")
    .default(""),
  replyToId: z.string().optional(),
  images: z.array(z.string()).max(4).optional(),
}).refine((data) => data.content.trim().length > 0 || (data.images && data.images.length > 0), {
  message: "Message must have content or images",
  path: ["content"],
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

const tradeCardPriceOrderingRefinement = (
  data: { direction: "LONG" | "SHORT"; entry: number; stopLoss: number; targets: number[] },
  ctx: z.RefinementCtx
) => {
  const { direction, entry, stopLoss, targets } = data;
  const tp = targets[0];
  if (direction === "LONG") {
    if (stopLoss >= entry)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "LONG: stop loss must be below entry", path: ["stopLoss"] });
    if (tp <= entry)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "LONG: target must be above entry", path: ["targets"] });
  } else {
    if (stopLoss <= entry)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SHORT: stop loss must be above entry", path: ["stopLoss"] });
    if (tp >= entry)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SHORT: target must be below entry", path: ["targets"] });
  }
};

export const sendTradeCardSchema = z
  .object({
    clanId: z.string().min(1),
    topicId: z.string().min(1),
    instrument: z.string().min(1).max(20),
    direction: z.enum(["LONG", "SHORT"]),
    entry: z.number().positive(),
    stopLoss: z.number().nonnegative(),
    targets: z.array(z.number().nonnegative()).length(1, "Exactly one take-profit target is required in v1"),
    timeframe: z.string().min(1).max(10),
    riskPct: z.number().min(0).max(100).optional(),
    note: z.string().max(500).optional(),
    tags: z.array(z.string().max(30)).max(5).optional(),
    cardType: z.enum(["SIGNAL", "ANALYSIS"]).optional().default("SIGNAL"),
  })
  .superRefine((data, ctx) => {
    // SIGNAL cards require positive SL and TP + price ordering
    if (data.cardType === "SIGNAL") {
      if (data.stopLoss <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Signal cards require a stop loss", path: ["stopLoss"] });
        return;
      }
      if (data.targets[0] <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Signal cards require a target", path: ["targets"] });
        return;
      }
      tradeCardPriceOrderingRefinement(data as { direction: "LONG" | "SHORT"; entry: number; stopLoss: number; targets: number[] }, ctx);
    }
    // ANALYSIS cards: SL and TP can be 0, but if both > 0 validate ordering
    if (data.cardType === "ANALYSIS" && data.stopLoss > 0 && data.targets[0] > 0) {
      tradeCardPriceOrderingRefinement(data as { direction: "LONG" | "SHORT"; entry: number; stopLoss: number; targets: number[] }, ctx);
    }
  });

export type SendTradeCardInput = z.infer<typeof sendTradeCardSchema>;

export const editTradeCardSchema = z
  .object({
    messageId: z.string().min(1),
    clanId: z.string().min(1),
    instrument: z.string().min(1).max(20),
    direction: z.enum(["LONG", "SHORT"]),
    entry: z.number().positive(),
    stopLoss: z.number().positive(),
    targets: z.array(z.number().positive()).length(1, "Exactly one take-profit target is required in v1"),
    timeframe: z.string().min(1).max(10),
    riskPct: z.number().min(0).max(100).optional(),
    note: z.string().max(500).optional(),
    tags: z.array(z.string().max(30)).max(5).optional(),
  })
  .superRefine(tradeCardPriceOrderingRefinement);

export type EditTradeCardInput = z.infer<typeof editTradeCardSchema>;

export const updateTradeStatusSchema = z.object({
  tradeId: z.string().min(1),
  clanId: z.string().min(1),
  status: z.enum(["PENDING", "OPEN", "TP_HIT", "SL_HIT", "BE", "CLOSED", "UNVERIFIED"]),
  note: z.string().max(500).optional(),
});

export type UpdateTradeStatusInput = z.infer<typeof updateTradeStatusSchema>;

export const updateStatementEligibilitySchema = z.object({
  statementEligible: z.boolean(),
  reason: z.string().min(1).max(500),
});

export type UpdateStatementEligibilityInput = z.infer<typeof updateStatementEligibilitySchema>;

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
  level: z.enum(["INFO", "WARN", "ERROR"]).optional(),
  category: z.enum(["AUTH", "EA", "TRADE", "CHAT", "ADMIN", "SYSTEM"]).optional(),
  search: z.string().max(100).optional(),
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
  joinRequestsEnabled: z.boolean().optional(),
});

export type ClanSettingsInput = z.infer<typeof clanSettingsSchema>;

// --- Join Request schemas ---

export const createJoinRequestSchema = z.object({
  message: z.string().max(500, "Message must be at most 500 characters").optional(),
});

export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;

export const reviewJoinRequestSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  rejectReason: z.string().max(500).optional(),
});

export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestSchema>;

// --- Direct Message schemas ---

export const sendDirectMessageSchema = z.object({
  content: z
    .string()
    .min(0)
    .max(2000, "Message must be at most 2000 characters")
    .default(""),
  replyToId: z.string().optional(),
  images: z.array(z.string()).max(4).optional(),
}).refine((data) => data.content.trim().length > 0 || (data.images && data.images.length > 0), {
  message: "Message must have content or images",
  path: ["content"],
});

export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;

export const editDirectMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters"),
});

export type EditDirectMessageInput = z.infer<typeof editDirectMessageSchema>;

// --- Trade Action schemas ---

export const tradeActionSchema = z.object({
  tradeId: z.string().min(1),
  clanId: z.string().min(1),
  actionType: z.enum(["SET_BE", "MOVE_SL", "CHANGE_TP", "CLOSE", "ADD_NOTE", "STATUS_CHANGE"]),
  newValue: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type TradeActionInput = z.infer<typeof tradeActionSchema>;

// --- EA Action Result schema ---

export const eaActionResultSchema = z.object({
  success: z.boolean(),
  errorMessage: z.string().max(500).optional(),
});

export type EaActionResultInput = z.infer<typeof eaActionResultSchema>;

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

// --- Test Run schemas ---

export const createTestRunSchema = z.object({
  suite: z.enum(["SMOKE", "FULL_E2E", "SIMULATOR"]),
  requestedWorkers: z.number().int().min(1).max(6).default(2),
  runMode: z.enum(["HEADLESS", "HEADED"]).default("HEADLESS"),
  options: z
    .object({
      slowMo: z.number().int().min(0).max(500).optional(),
      video: z.boolean().optional(),
      trace: z.boolean().optional(),
    })
    .optional(),
});

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;

export const updateTestRunSchema = z.object({
  status: z.enum(["QUEUED", "CLAIMED", "RUNNING", "PASSED", "FAILED", "CANCELED"]).optional(),
  workerHostname: z.string().max(200).optional(),
  totalTests: z.number().int().min(0).optional(),
  passedTests: z.number().int().min(0).optional(),
  failedTests: z.number().int().min(0).optional(),
  skippedTests: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
  errorMessage: z.string().max(5000).optional(),
});

export type UpdateTestRunInput = z.infer<typeof updateTestRunSchema>;

// --- Badge schemas ---

const rankRequirementsSchema = z.object({
  type: z.literal("rank"),
  min_closed_trades: z.number().int().min(1),
});

const performanceRequirementsSchema = z.object({
  type: z.literal("performance"),
  metric: z.enum(["net_r", "avg_r", "max_drawdown_r", "win_rate"]),
  window: z.number().int().min(1).max(10000),
  op: z.enum([">=", "<=", ">", "<"]),
  value: z.number(),
});

const trophyRequirementsSchema = z.object({
  type: z.literal("trophy"),
  season_id: z.string().min(1),
  lens: z.string().min(1),
  rank_min: z.number().int().min(1),
  rank_max: z.number().int().min(1),
});

const manualRequirementsSchema = z.object({
  type: z.literal("manual"),
});

const badgeRequirementsSchema = z.discriminatedUnion("type", [
  rankRequirementsSchema,
  performanceRequirementsSchema,
  trophyRequirementsSchema,
  manualRequirementsSchema,
]);

export const createBadgeDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Key must be lowercase with hyphens"),
  category: z.enum(["RANK", "PERFORMANCE", "TROPHY", "OTHER"]),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconUrl: z.string().max(500).optional(),
  iconAssetKey: z.string().max(100).optional(),
  requirementsJson: badgeRequirementsSchema,
  enabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type CreateBadgeDefinitionInput = z.infer<typeof createBadgeDefinitionSchema>;

export const updateBadgeDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500).optional().nullable(),
  iconAssetKey: z.string().max(100).optional().nullable(),
  requirementsJson: badgeRequirementsSchema.optional(),
  enabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type UpdateBadgeDefinitionInput = z.infer<typeof updateBadgeDefinitionSchema>;

export const badgeReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      displayOrder: z.number().int().min(0),
    })
  ).min(1),
});

export type BadgeReorderInput = z.infer<typeof badgeReorderSchema>;

export const badgeRecomputeSchema = z.object({
  scope: z.enum(["user", "badge", "all"]),
  targetId: z.string().optional(),
});

export type BadgeRecomputeInput = z.infer<typeof badgeRecomputeSchema>;

export const badgeDryRunSchema = z.object({
  badgeId: z.string().min(1),
  requirementsJson: badgeRequirementsSchema,
});

export type BadgeDryRunInput = z.infer<typeof badgeDryRunSchema>;
