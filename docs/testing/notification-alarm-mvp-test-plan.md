# Test Plan — Notification + Alarm MVP

> Last updated: 2026-03-13 (hardened)

## Scope

Covers the full Notification + Price Alert MVP: notification center UI, preferences, account/clan notification types, price alert creation/evaluation/management, dedupe/cooldown, real-time delivery.

## Preconditions

- Logged-in user with at least one clan membership
- At least one MT account connected (for trading-related notifications)
- EA running and sending heartbeats (for tracking/trade notifications)
- Dev server running with Socket.io connected

## Site scenarios

### Notification Center UI
1. **Bell icon visible**: Logged-in user sees bell icon in TopBar
2. **Unread badge**: Badge shows correct unread count (0 = hidden, 99+ cap)
3. **Dropdown opens**: Click bell → dropdown shows recent notifications (max 10-15)
4. **Severity indicators**: Critical (red), Important (amber), Updates (blue/gray) icons/colors
5. **Click notification**: Marks as read, navigates to CTA href if present
6. **See all link**: Links to /notifications full page
7. **Mark all as read**: Button in dropdown, clears all unread
8. **Empty state**: When no notifications, shows friendly message
9. **Real-time update**: New notification appears in dropdown without refresh
10. **Mobile layout**: Dropdown works on mobile (full-width or sheet)

### Full Notifications Page
11. **List view**: All notifications in chronological order (newest first)
12. **Filter tabs**: All / Critical / Important / Updates / Unread
13. **Mark all as read**: Works from page view
14. **Pagination/scroll**: Loads more on scroll or pagination
15. **RTL layout**: Correct in Persian mode (logical CSS)

### Notification Preferences
16. **Settings page**: /settings/notifications accessible from settings nav
17. **In-app toggle**: ON/OFF switch, default ON
18. **Delivery mode**: Critical only / All alerts selector
19. **Preferences respected**: When set to "critical only", important/update notifications created but not delivered via socket
20. **Preferences OFF**: No socket delivery at all, notifications still in DB

### Price Alert Creation
21. **Modal opens**: From symbol UI or dedicated button
22. **Form fields**: Symbol (pre-filled or selectable), Condition (Above/Below), Target price
23. **Validation**: Target price must be positive number, symbol must be valid
24. **Immediate trigger**: If current price already past threshold, trigger immediately
25. **Success feedback**: Toast confirmation on creation
26. **Max limit**: Reject creation if user has 20 active alerts

### Price Alert Evaluation
27. **Server-side check**: Alerts evaluated on server interval (not client)
28. **ABOVE trigger**: Price crosses above target → alert triggered, notification created
29. **BELOW trigger**: Price crosses below target → alert triggered, notification created
30. **One-time only**: Triggered alert does not re-trigger
31. **Source-group aware**: Uses same pricing logic as rest of app (getDisplayPrice)
32. **Weekend handling**: Does not trigger on stale weekend prices

### Price Alert Management
33. **Active alerts list**: Shows all active alerts with symbol, condition, target, status
34. **Cancel alert**: User can cancel active alerts
35. **Triggered state**: Triggered alerts show triggered timestamp
36. **Delete**: User can delete any alert (active or triggered)

## MetaTrader scenarios

### Tracking / Heartbeat Alerts
37. **Tracking lost**: Stop EA → within ~10min, user receives critical notification "Your account stopped sending live data..."
38. **Tracking restored**: Restart EA → user receives important notification "Your account is back online..."
39. **Tracking flap**: Stop/start EA rapidly → only ONE notification per cooldown window (no spam)

### Trade Action Result Alerts
40. **Close trade**: EA closes trade → notification with outcome (TP hit, SL hit, etc.)
41. **Modify SL/TP**: SL/TP modified → notification with details
42. **Break-even**: BE set → notification confirming
43. **Action failed**: If action fails → critical notification

### Signal Qualification Alerts
44. **Qualification missed**: Trade misses 20s window → important notification "Trade became analysis-only"
45. **Signal qualified**: Trade qualifies → update notification (low priority)

### Integrity Alerts
46. **Eligibility lost**: Trade loses statement eligibility → important notification
47. **Integrity verified**: Trade passes all 7 conditions → update notification

## Edge-case scenarios

48. **Rapid rank changes**: Rank changes by ±1 repeatedly → only notify on ±3 or top-3 entry/exit
49. **Multiple MT accounts**: Each account's tracking status creates separate notifications
50. **Price alert created at exact price**: Current price = target price → trigger immediately
51. **User with preferences OFF**: Notifications created in DB but not delivered
52. **Large notification history**: 1000+ notifications → pagination works, no performance issues
53. **Concurrent alert triggers**: Two alerts for same symbol, different conditions → both trigger correctly
54. **Socket disconnect/reconnect**: Unread count syncs correctly after reconnect

## Expected results

| Scenario | Expected |
|----------|----------|
| Bell icon | Always visible for logged-in users |
| Unread count | Accurate, real-time, capped at 99+ |
| Critical notification | Toast shown + persisted + bell badge |
| Important notification | Persisted + subtle toast if user active |
| Update notification | Persisted only, no toast |
| Preferences OFF | No delivery, notifications still in DB |
| Critical-only mode | Only critical severity delivered |
| Price ABOVE trigger | Notification when price crosses up |
| Price BELOW trigger | Notification when price crosses down |
| Tracking lost | Critical notification within tracking timeout |
| Dedupe working | No spam on repeated events within cooldown |

## Automated test coverage

### Unit tests (Vitest) — 65 tests
- `src/services/__tests__/notification.service.test.ts` (29 tests): create, cooldown, preferences, unread count, mark read, list pagination, batch
- `src/services/__tests__/price-alert.service.test.ts` (36 tests): create, cancel, delete, evaluate, immediate trigger, max limit, source-group, weekend guard

### E2E tests (Playwright REST) — `e2e/simulator/11-notifications.spec.ts`
- Notification preferences GET/PATCH
- Unread count endpoint
- Notification list with severity and unread filters
- Mark all read + verify count=0
- Price alert CRUD (create, list, cancel, delete)
- Immediate trigger (BELOW with high target)
- Max alerts limit enforcement
- Input validation (missing fields, invalid condition, negative price)
- Mark single notification as read
- Auth guard (unauthenticated returns 401)

## Not yet tested

- Telegram delivery (not in MVP)
- Web push notifications (not in MVP)
- Email notifications (not in MVP)
- Badge/streak notifications (not in MVP)
- Advanced automation rules (not in MVP)
- Load testing with many concurrent users
- Cross-browser push notification support
- Socket.io real-time delivery (tested manually, not in automated E2E)
- Toast behavior per severity level (requires browser-level E2E)
