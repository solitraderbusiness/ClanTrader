"use client";

import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";
import { Bell, BellRing, Smartphone, Volume2 } from "lucide-react";
import {
  type PushCategory,
  PUSH_CATEGORY_ORDER,
  DEFAULT_PUSH_CATEGORIES,
} from "@/lib/notification-types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** i18n key mapping for each push category */
const CATEGORY_I18N: Record<PushCategory, { label: string; desc: string }> = {
  trades: { label: "notifications.catTrades", desc: "notifications.catTradesDesc" },
  price_alerts: { label: "notifications.catPriceAlerts", desc: "notifications.catPriceAlertsDesc" },
  risk: { label: "notifications.catRisk", desc: "notifications.catRiskDesc" },
  tracking: { label: "notifications.catTracking", desc: "notifications.catTrackingDesc" },
  integrity: { label: "notifications.catIntegrity", desc: "notifications.catIntegrityDesc" },
  clan: { label: "notifications.catClan", desc: "notifications.catClanDesc" },
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Resolve stored categories (empty = all enabled) */
function resolveCategories(
  stored: Record<string, boolean> | null | undefined
): Record<PushCategory, boolean> {
  if (!stored || Object.keys(stored).length === 0) {
    return { ...DEFAULT_PUSH_CATEGORIES };
  }
  const result = { ...DEFAULT_PUSH_CATEGORIES };
  for (const [key, val] of Object.entries(stored)) {
    if (key in result) {
      result[key as PushCategory] = val;
    }
  }
  return result;
}

/** Play double-beep sound using Web Audio API */
function playTestSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available
  }
}

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"all" | "critical_only">("all");
  const [pushCategories, setPushCategories] = useState<Record<PushCategory, boolean>>(
    { ...DEFAULT_PUSH_CATEGORIES }
  );
  const [loading, setLoading] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [pushSubscribing, setPushSubscribing] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
    setPushSupported(supported);
    if (supported) {
      setPushPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    fetch("/api/users/me/notification-preferences")
      .then((r) => r.json())
      .then((data) => {
        setInAppEnabled(data.inAppEnabled ?? true);
        setSoundEnabled(data.soundEnabled ?? true);
        setPushEnabled(data.pushEnabled ?? false);
        setDeliveryMode(data.deliveryMode ?? "all");
        setPushCategories(resolveCategories(data.pushCategories));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updatePref = useCallback(async (updates: {
    inAppEnabled?: boolean;
    soundEnabled?: boolean;
    pushEnabled?: boolean;
    deliveryMode?: string;
    pushCategories?: Record<string, boolean>;
  }) => {
    const res = await fetch("/api/users/me/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      toast.success(t("notifications.prefsSaved"));
    }
  }, [t]);

  const handleInAppToggle = useCallback((checked: boolean) => {
    setInAppEnabled(checked);
    updatePref({ inAppEnabled: checked });
  }, [updatePref]);

  const handleSoundToggle = useCallback((checked: boolean) => {
    setSoundEnabled(checked);
    updatePref({ soundEnabled: checked });
  }, [updatePref]);

  const handleModeChange = useCallback((mode: "all" | "critical_only") => {
    setDeliveryMode(mode);
    updatePref({ deliveryMode: mode });
  }, [updatePref]);

  const handleCategoryToggle = useCallback((category: PushCategory, checked: boolean) => {
    setPushCategories((prev) => {
      const next = { ...prev, [category]: checked };
      updatePref({ pushCategories: next });
      return next;
    });
  }, [updatePref]);

  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return;
    setPushSubscribing(true);

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        toast.error(t("notifications.pushDenied"));
        setPushSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys) {
        throw new Error("Invalid subscription");
      }

      const res = await fetch("/api/users/me/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        }),
      });

      if (res.ok) {
        setPushEnabled(true);
        toast.success(t("notifications.pushEnabled"));
      } else {
        throw new Error("Failed to save subscription");
      }
    } catch (err) {
      console.error("[Push] subscribe error:", err);
      toast.error(t("notifications.pushError"));
    } finally {
      setPushSubscribing(false);
    }
  }, [pushSupported, t]);

  const unsubscribeFromPush = useCallback(async () => {
    setPushSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch("/api/users/me/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setPushEnabled(false);
      await updatePref({ pushEnabled: false });
      toast.success(t("notifications.pushDisabled"));
    } catch (err) {
      console.error("[Push] unsubscribe error:", err);
      toast.error(t("notifications.pushError"));
    } finally {
      setPushSubscribing(false);
    }
  }, [t, updatePref]);

  const handleTestPopup = useCallback(() => {
    toast.info(t("notifications.testPopupTitle"), {
      description: t("notifications.testPopupBody"),
      duration: 5000,
    });
  }, [t]);

  const handleTestSound = useCallback(() => {
    playTestSound();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t("notifications.prefsTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("notifications.prefsDescription")}
        </p>
      </div>

      {/* Section 1: Notification History — always on */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t("notifications.historyTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.historyDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Live popups toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="inapp-toggle" className="text-sm font-medium">
              {t("notifications.inAppEnabled")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("notifications.inAppEnabledDesc")}
            </p>
          </div>
        </div>
        <Switch
          id="inapp-toggle"
          checked={inAppEnabled}
          onCheckedChange={handleInAppToggle}
        />
      </div>

      {/* Section 3: Sound toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="sound-toggle" className="text-sm font-medium">
              {t("notifications.soundEnabled")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("notifications.soundEnabledDesc")}
            </p>
          </div>
        </div>
        <Switch
          id="sound-toggle"
          checked={soundEnabled}
          onCheckedChange={handleSoundToggle}
        />
      </div>

      {/* Section 4: Push notifications — only show if VAPID configured */}
      {pushSupported && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">
                {t("notifications.pushNotifications")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("notifications.pushDesc")}
              </p>
              {pushPermission === "denied" && (
                <p className="mt-1 text-xs text-red-500">
                  {t("notifications.pushBlocked")}
                </p>
              )}
            </div>
          </div>
          {pushEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={unsubscribeFromPush}
              disabled={pushSubscribing}
            >
              {pushSubscribing ? t("common.loading") : t("notifications.pushDisableBtn")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={subscribeToPush}
              disabled={pushSubscribing || pushPermission === "denied"}
            >
              <BellRing className="me-1.5 h-3.5 w-3.5" />
              {pushSubscribing ? t("common.loading") : t("notifications.pushEnableBtn")}
            </Button>
          )}
        </div>
      )}

      {/* Push categories — only show when push is enabled */}
      {pushSupported && pushEnabled && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">{t("notifications.pushCategoriesTitle")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("notifications.pushCategoriesDesc")}
            </p>
          </div>
          <div className="space-y-1">
            {PUSH_CATEGORY_ORDER.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{t(CATEGORY_I18N[cat].label)}</p>
                  <p className="text-xs text-muted-foreground">{t(CATEGORY_I18N[cat].desc)}</p>
                </div>
                <Switch
                  checked={pushCategories[cat]}
                  onCheckedChange={(checked) => handleCategoryToggle(cat, checked)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Delivery mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("notifications.deliveryMode")}</Label>
        <div className="space-y-2">
          <button
            onClick={() => handleModeChange("all")}
            className={`flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors ${
              deliveryMode === "all"
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <div
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                deliveryMode === "all" ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {deliveryMode === "all" && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{t("notifications.modeAll")}</p>
              <p className="text-xs text-muted-foreground">{t("notifications.modeAllDesc")}</p>
            </div>
          </button>

          <button
            onClick={() => handleModeChange("critical_only")}
            className={`flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors ${
              deliveryMode === "critical_only"
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
          >
            <div
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                deliveryMode === "critical_only" ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {deliveryMode === "critical_only" && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{t("notifications.modeCriticalOnly")}</p>
              <p className="text-xs text-muted-foreground">
                {t("notifications.modeCriticalOnlyDesc")}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Section 6: Test actions */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("notifications.testTitle")}</Label>
        <p className="text-xs text-muted-foreground">{t("notifications.testDesc")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestPopup}>
            {t("notifications.testPopup")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleTestSound}>
            <Volume2 className="me-1.5 h-3.5 w-3.5" />
            {t("notifications.testSound")}
          </Button>
        </div>
      </div>
    </div>
  );
}
