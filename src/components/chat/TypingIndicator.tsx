"use client";

interface TypingIndicatorProps {
  typingUsers: Map<string, string>;
  currentUserId: string;
}

export function TypingIndicator({
  typingUsers,
  currentUserId,
}: TypingIndicatorProps) {
  const others = Array.from(typingUsers.entries()).filter(
    ([id]) => id !== currentUserId
  );

  if (others.length === 0) return null;

  const names = others.map(([, name]) => name || "Someone");
  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names.length} people are typing`;
  }

  return (
    <div className="flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground">
      <span>{text}</span>
      <span className="flex items-center gap-0.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </div>
  );
}
