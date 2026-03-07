const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramError(
  title: string,
  details: string,
  extra?: { url?: string; user?: string }
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const ctx = [
    extra?.url && `URL: ${extra.url}`,
    extra?.user && `User: ${extra.user}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Truncate details to fit Telegram's 4096 char limit
  const maxDetails = 3200;
  const truncated =
    details.length > maxDetails
      ? details.slice(0, maxDetails) + "\n... (truncated)"
      : details;

  const text =
    `🔴 *Error — ${escapeMarkdown(title)}*\n` +
    `⏱ ${timestamp}\n` +
    (ctx ? `${escapeMarkdown(ctx)}\n` : "") +
    `\n\`\`\`\n${truncated}\n\`\`\``;

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );
  } catch {
    // Silent fail — don't crash the app because of Telegram
  }
}

/**
 * Generic Telegram message sender.
 * Use parse_mode "HTML" for rich formatting without Markdown escape headaches.
 * Splits long messages into chunks if they exceed Telegram's 4096 char limit.
 */
export async function sendTelegramMessage(
  text: string,
  options?: { parseMode?: "Markdown" | "HTML"; chatId?: string }
) {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = options?.chatId || TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const parseMode = options?.parseMode ?? "HTML";
  const MAX_LEN = 4096;

  // Split into chunks if needed
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }
    // Find last newline before limit to avoid mid-word split
    let splitAt = remaining.lastIndexOf("\n", MAX_LEN);
    if (splitAt < MAX_LEN * 0.5) splitAt = MAX_LEN;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  for (const chunk of chunks) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
    } catch {
      // Silent fail
    }
  }
}

function escapeMarkdown(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

/** Escape special chars for Telegram HTML parse mode */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
