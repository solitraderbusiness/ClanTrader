"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { useTranslation } from "@/lib/i18n";

interface EventReminderPayload {
  event: {
    id: string;
    title: string;
    impact: string;
    currency: string | null;
    startTime: string;
  };
  reminderType: "1_HOUR" | "1_MINUTE";
}

export function EventReminderListener() {
  const { t } = useTranslation();

  useEffect(() => {
    const socket = getSocket();

    function handleReminder(payload: EventReminderPayload) {
      const { event, reminderType } = payload;
      const desc = t("events.reminderDesc", {
        impact: event.impact,
        currency: event.currency || "",
      });

      if (reminderType === "1_HOUR") {
        toast.info(t("events.reminder1h", { title: event.title }), {
          description: desc,
          duration: 8000,
        });
      } else {
        toast.warning(t("events.reminder1m", { title: event.title }), {
          description: desc,
          duration: 12000,
        });
      }
    }

    socket.on(SOCKET_EVENTS.EVENT_REMINDER, handleReminder);
    return () => {
      socket.off(SOCKET_EVENTS.EVENT_REMINDER, handleReminder);
    };
  }, [t]);

  return null;
}
