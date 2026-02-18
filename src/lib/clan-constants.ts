export const CLAN_LIMITS = {
  FREE: 3,
  PRO: 6,
} as const;

export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 30;
export const CLAN_DESCRIPTION_MAX = 500;
export const INVITE_CODE_LENGTH = 10;

export const TRADING_FOCUSES = [
  "Forex",
  "Crypto",
  "Gold & Metals",
  "Indices",
  "Mixed",
] as const;

// Channel post constants
export const CHANNEL_POST_CONTENT_MAX = 5000;
export const CHANNEL_POST_TITLE_MAX = 200;
export const CHANNEL_POST_IMAGES_MAX = 4;
export const CHANNEL_POSTS_PER_PAGE = 20;

export const REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🔥",
  "👏",
  "🚀",
  "👀",
  "💯",
  "🤔",
] as const;
