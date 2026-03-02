---
name: ea-debug
description: Debug MetaTrader EA integration issues including trade sync, signal matching, heartbeat, and live R:R
disable-model-invocation: true
argument-hint: [ticket-number-or-description]
context: fork
agent: Explore
---

Debug EA integration issue: $ARGUMENTS

**Investigation steps:**

1. **Check PM2 logs** for recent errors:
   - `pm2 logs clantrader --lines 200 --nostream` — grep for "error", "ea", "trade"

2. **Query recent EA audit logs** from database:
   - `auditLog` where action starts with `ea.` — ordered by createdAt desc, last 20
   - Look for: `ea.trade_event`, `ea.broadcast_pnl_error`, `ea.sync_modification_error`, `ea.sync_close_error`

3. **Query recent trade events** from database:
   - `tradeEvent` ordered by createdAt desc, last 20
   - Check actionType, note, source, timestamps

4. **Check Redis locks** that might be blocking:
   - `ea-heartbeat:{accountId}` — 10s rate limit
   - `ea-signal-lock:{accountId}:{ticket}` — 60s auto-create lock
   - `ea-mod-lock:{tradeId}:{sl}:{tp}` — 30s modification dedup lock
   - `calendar-sync-limit:{accountId}` — 5min sync rate limit

5. **Trace the code flow** through:
   - `src/app/api/ea/trade-event/route.ts` → `handleTradeEvent()`
   - `src/services/ea.service.ts` → `processHeartbeat()`, `upsertMtTrade()`
   - `src/services/ea-signal.service.ts` → `autoCreateSignalFromMtTrade()`, `syncSignalModification()`, `syncSignalClose()`
   - `src/services/ea-signal.service.ts` → `broadcastMessages()` (MESSAGE_EDITED emission)

6. **Check Socket.io** connectivity:
   - Is the user's socket connected? Check PM2 logs for "Socket connected" entries
   - Is the client in the right room? (topic:{clanId}:{topicId})

**Report:**
- Timeline of events with exact timestamps
- Root cause identification
- Which Redis lock or race condition (if any) blocked the update
- Suggested fix with specific file:line references
