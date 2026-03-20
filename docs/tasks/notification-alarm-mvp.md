# Task Brief — Notification + Alarm MVP

> Started: 2026-03-13
> Status: DONE
> Completed: 2026-03-20

## 1. Goal

Build a clean Notification MVP for ClanTrader with two parts:

**A) Account / Clan Notifications** — System-generated alerts that protect the user or keep them informed (tracking lost, trade action results, risk warnings, integrity events, rank changes).

**B) Asset Price Alerts** — User-created simple market alerts: price goes ABOVE X, price goes BELOW X. One-time triggers, server-side evaluated.

Design principle: "ClanTrader only interrupts me when something actually matters."

## 2. Why it exists

- No in-app notification system exists today (SOURCE_OF_TRUTH §2 Notifications: "No in-app notification system")
- Users have no way to know when tracking is lost, trades close, or integrity changes unless they're actively looking
- Price alerts are a basic expectation of any trading platform
- Smart underneath, simple on the surface — no enterprise notification engine

## 3. Current decisions

- **Channel: in-app + web push** — Telegram, email, SMS deferred. Web push via VAPID (full implementation exists, shown only when configured).
- **3 severity levels**: Critical, Important, Updates — consistent in UI and backend
- **Toast behavior**: Critical = toast + persist, Important = persist + optional subtle toast, Updates = persist only
- **Preferences**: minimal — in-app on/off + critical-only/all. No per-category matrix.
- **Price alerts**: ABOVE/BELOW only, one-time trigger, server-side evaluation using price-pool.service.ts
- **Dedupe/cooldown**: lightweight dedupe keys + cooldown windows for noisy events (tracking flap, rank movements)
- **Architecture extensible** for future Telegram/push/email but NOT exposed now

## 4. Rules touched

- No existing product rules changed
- New notification types reference existing systems: integrity contract, signal qualification, tracking status, trade actions, rankings
- Price alerts use existing price pool (source-group aware, 5-layer Redis cache)

## 5. Files / systems involved

### New files to create
- `prisma/schema.prisma` — add Notification, NotificationPreference, PriceAlert models + enums
- `src/services/notification.service.ts` — centralized notification creation/delivery/dedupe
- `src/services/price-alert.service.ts` — price alert evaluation engine
- `src/lib/notification-types.ts` — notification type definitions, severity mappings, copy templates
- `src/lib/socket-handlers/notification-handlers.ts` — socket event handlers
- `src/components/notifications/NotificationBell.tsx` — bell icon + dropdown
- `src/components/notifications/NotificationItem.tsx` — single notification row
- `src/components/notifications/NotificationList.tsx` — notification list with filters
- `src/components/notifications/PriceAlertModal.tsx` — create price alert modal
- `src/components/notifications/PriceAlertList.tsx` — active alerts management
- `src/app/(main)/notifications/page.tsx` — full notifications page
- `src/app/(main)/settings/notifications/page.tsx` — notification preferences
- `src/app/api/notifications/route.ts` — list + mark-all-read
- `src/app/api/notifications/[notificationId]/route.ts` — mark-read, delete
- `src/app/api/notifications/unread-count/route.ts` — unread count endpoint
- `src/app/api/price-alerts/route.ts` — create + list
- `src/app/api/price-alerts/[alertId]/route.ts` — cancel/delete
- `src/app/api/users/me/notification-preferences/route.ts` — get/update prefs

### Existing files to modify
- `prisma/schema.prisma` — add models
- `src/lib/chat-constants.ts` — add NOTIFICATION_NEW, NOTIFICATION_COUNT_UPDATE socket events
- `src/components/layout/TopBar.tsx` — add NotificationBell
- `server.ts` — add price alert evaluation interval
- `src/services/ea.service.ts` — hook tracking status change notifications
- `src/services/ea-signal-close.service.ts` — hook trade close notifications
- `src/services/ea-signal-modify.service.ts` — hook trade modify notifications
- `src/services/signal-qualification.service.ts` — hook qualification miss notifications
- `src/services/integrity.service.ts` — hook eligibility change notifications
- `src/services/ranking.service.ts` — hook rank change notifications
- `src/services/trade-action.service.ts` — hook action result notifications
- `src/locales/en.json` — notification i18n keys
- `src/locales/fa.json` — notification i18n keys

## 6. Edge cases

1. **Tracking flap**: Account goes STALE→ACTIVE→STALE rapidly — dedupe with cooldown. Original 10min cooldown + 2min threshold proved too aggressive on Iranian internet. Raised to 1hr cooldown + 5min threshold.
2. **Rank micro-movements**: Rank changes by 1 position constantly — only notify on meaningful jumps (±3 or entering/leaving top 3)
3. **Price alert at creation**: Current price already past threshold — trigger immediately
4. **Price alert during market close**: Don't trigger on stale weekend prices — check `isMarketOpen()` or price freshness
5. **Multiple MT accounts**: Tracking alerts are per-account, not per-user
6. **User preferences OFF**: Still create notifications in DB but don't deliver via socket/toast
7. **Unread count overflow**: Cap display at 99+
8. **Concurrent price alert evaluation**: Use Redis lock or status check to prevent double-trigger
9. **Alert ABOVE must be > current price, BELOW must be < current price** — validate at creation with live price
10. **Alert cancel vs delete**: Cancel = stop monitoring (CANCELLED status). Delete from history = soft-delete (hide from UI, preserve in DB for future analytics/heatmap)
11. **Push controls visible but push not real**: If VAPID keys not configured or push not end-to-end tested, hide push UI section entirely
12. **Unread count race**: Socket delivery and polling fallback can race — single source of truth must prevail
13. **Audio on muted browser**: Gracefully handle autoplay policy — no error, just silent

## 7. Manual test scenarios

1. Create notification → unread count increments in bell icon
2. Open dropdown → see recent notifications with severity icons
3. Click notification → marks as read, navigates if CTA exists
4. Mark all as read → count resets to 0
5. Set preferences to "critical only" → only critical notifications appear
6. Set preferences to OFF → no notifications delivered (but still in DB)
7. Disconnect EA → tracking lost notification appears (critical)
8. Reconnect EA → tracking restored notification appears (important)
9. Close a trade via EA → trade close notification appears
10. Trade misses 20s window → analysis-only notification
11. Create ABOVE price alert → triggers when price crosses up
12. Create BELOW price alert → triggers when price crosses down
13. Cancel active alert → removed from list
14. Triggered alert → shows triggered state, creates notification
15. Rapid tracking flap → only one notification per cooldown window

## 8. Done definition

All of these must be true:
1. Bell icon with unread count in navbar
2. Notifications persisted in DB and visible in dropdown + full page
3. Mark as read / mark all as read working
4. Simple preferences UI (in-app on/off, critical-only/all)
5. At least these notification types wired from real events: tracking lost/restored, trade action results, one risk warning, one integrity/qualification flow
6. User can create ABOVE/BELOW price alerts
7. Price alerts evaluated server-side and trigger correctly
8. Dedupe/cooldown prevents spam on noisy events
9. No feature creep (no Telegram/push/email/SMS/automation)
10. i18n keys in both en.json and fa.json
11. Unit tests pass, lint passes, build succeeds

## 9. Open questions

All resolved:
1. ~~Should price alert evaluation run on heartbeat cycle (30s) or its own interval?~~ → own interval, 15s
2. ~~Where to surface "Set Alert" button?~~ → Crosshair icon in TopBar, plus digest/journal contexts
3. ~~Max active price alerts per user?~~ → 20 (hardcoded constant)
4. ~~Should rank notifications require minimum trade count?~~ → yes, uses existing min trade count from ranking service

## 10. Change notes

| Date | Change |
|------|--------|
| 2026-03-13 | Initial task brief created from comprehensive product spec |
| 2026-03-13 | Hardening pass: proper Prisma migration, E2E test, toggle wording clarified, SOURCE_OF_TRUTH updated |
| 2026-03-13 | User feedback: "all notifications are Connection lost — too sensitive to connection." TRACKING_LOST threshold (120s) too aggressive for Iranian internet. Cooldown (600s) not enough. Fix: raise threshold to 5min, raise cooldown to 1hr, demote TRACKING_LOST from CRITICAL to IMPORTANT. |
| 2026-03-19 | **UX audit + polish pass started.** Task reopened for targeted hardening. Scope: (A) notification state/count trust fixes, (B) severity/icon UX mapping, (C) connection-lost dedupe/collapse, (D) alert icon distinct from bell, (E) alert badge semantics, (F) active vs history separation, (G) cancel/delete → soft-delete for analytics, (H) price alert modal improvements (live price, validation), (I) settings page clarity, (J) audio settings, (K) test actions. Also: future heatmap data preservation for alert history. |
| 2026-03-20 | **Task finalized — DONE.** All done-definition items verified: bell with unread count, DB persistence, mark-read flows, preferences UI, 5+ notification types wired from real events (tracking, trade actions, risk, integrity, rank), ABOVE/BELOW price alerts with candle-style M1 evaluation, dedupe/cooldown for noisy events, broker symbol autocomplete, audio alerts, i18n in both locales, 65+ unit tests passing, lint + build clean. UX polish pass (2026-03-19) completed all 11 items. No feature creep (no Telegram/push/email/SMS). |
