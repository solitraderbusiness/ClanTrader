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

// Socket events
export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_CLAN: "join_clan",
  LEAVE_CLAN: "leave_clan",
  SEND_MESSAGE: "send_message",
  PIN_MESSAGE: "pin_message",
  UNPIN_MESSAGE: "unpin_message",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",

  // Server -> Client
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_PINNED: "message_pinned",
  MESSAGE_UNPINNED: "message_unpinned",
  USER_TYPING: "user_typing",
  USER_STOP_TYPING: "user_stop_typing",
  PRESENCE_UPDATE: "presence_update",
  ERROR: "error",
} as const;
