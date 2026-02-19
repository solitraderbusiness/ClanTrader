// Message constraints
export const MESSAGE_CONTENT_MAX = 2000;
export const MESSAGE_CONTENT_MIN = 1;
export const MESSAGES_PER_PAGE = 50;
export const MAX_PINNED_MESSAGES = 10;

// Rate limiting
export const MESSAGE_RATE_LIMIT = 5; // max messages
export const MESSAGE_RATE_WINDOW = 10; // per N seconds

// Typing indicator
export const TYPING_TIMEOUT_MS = 3000;

// Presence
export const PRESENCE_TTL = 300; // Redis key TTL in seconds (5 min)

// Message reactions
export const MESSAGE_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

// Topics
export const MAX_TOPICS_PER_CLAN = 20;
export const TOPIC_NAME_MAX = 30;
export const TOPIC_NAME_MIN = 2;
export const TOPIC_DESCRIPTION_MAX = 200;

// Trade card
export const TRADE_TIMEFRAMES = [
  "M1", "M5", "M15", "M30",
  "H1", "H4",
  "D1", "W1", "MN",
] as const;

export const COMMON_INSTRUMENTS = [
  "XAUUSD", "XAGUSD",
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",
  "EURGBP", "EURJPY", "GBPJPY",
  "BTCUSD", "ETHUSD",
  "US30", "NAS100", "SPX500",
  "USOIL", "UKOIL",
] as const;

export const TRADE_STATUSES = [
  "OPEN", "TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED",
] as const;

// Socket events
export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_CLAN: "join_clan",
  LEAVE_CLAN: "leave_clan",
  SWITCH_TOPIC: "switch_topic",
  SEND_MESSAGE: "send_message",
  EDIT_MESSAGE: "edit_message",
  DELETE_MESSAGE: "delete_message",
  PIN_MESSAGE: "pin_message",
  UNPIN_MESSAGE: "unpin_message",
  REACT_MESSAGE: "react_message",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",
  SEND_TRADE_CARD: "send_trade_card",
  EDIT_TRADE_CARD: "edit_trade_card",
  TRACK_TRADE: "track_trade",
  UPDATE_TRADE_STATUS: "update_trade_status",
  EXECUTE_TRADE_ACTION: "execute_trade_action",

  // Server -> Client
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_EDITED: "message_edited",
  MESSAGE_DELETED: "message_deleted",
  MESSAGE_PINNED: "message_pinned",
  MESSAGE_UNPINNED: "message_unpinned",
  MESSAGE_REACTED: "message_reacted",
  USER_TYPING: "user_typing",
  USER_STOP_TYPING: "user_stop_typing",
  PRESENCE_UPDATE: "presence_update",
  TOPIC_CREATED: "topic_created",
  TOPIC_UPDATED: "topic_updated",
  TOPIC_ARCHIVED: "topic_archived",
  TRADE_STATUS_UPDATED: "trade_status_updated",
  TRADE_ACTION_EXECUTED: "trade_action_executed",
  ERROR: "error",
} as const;
