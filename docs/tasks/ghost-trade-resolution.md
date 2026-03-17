# Ghost Trade Resolution — Auto-evaluate trades when MT disconnects permanently

> Status: BACKLOG
> Priority: Post-MVP
> Created: 2026-03-14

## 1. Problem

When a user's MT disconnects and never reconnects, their open trade cards stay in "open" state forever — even if the broker already closed the trade (SL/TP hit). This distorts:
- Live risk overlay (phantom open position)
- Effective rank (stale penalty or bonus)
- Clan leaderboard
- Trader statement (missing closed trade)

## 2. Solution — Two-phase approach

### Phase 1: Advisory chat message (lightweight)

When the heartbeat fallback detects that the cross-source price has crossed a trade's SL or TP level:
- Post a system message in the clan chat, replying to the trade card
- Wording: "Price has crossed the stop-loss/take-profit level. Final result will be confirmed when MT reconnects."
- This is informational only — no trade card status change
- Trigger: fallback price crosses SL or TP while account is STALE or TRACKING_LOST

### Phase 2: Auto-evaluation after prolonged disconnection

After X days of TRACKING_LOST (suggested: 7 days):
- Trigger the existing trade evaluator (`trade-evaluator.service.ts`) with candle data
- If candles confirm SL/TP was hit, close the trade with resolution type `EVALUATOR`
- Post official close message in chat
- Update statement and ranking
- If candles are inconclusive, mark trade as `NEEDS_REVIEW` for admin

### Integrity considerations

- Evaluator-resolved trades can still be `statementEligible` if all 7 integrity conditions passed at qualification time
- Resolution source should be clearly marked as `EVALUATOR` (not `EA` or `MANUAL`)
- Admin should be able to override evaluator decisions

## 3. Decisions

- Server never executes trades on the broker — only observes via EA
- Cross-source fallback prices are display-grade, not verification-grade — advisory messages should reflect uncertainty
- 7-day timeout is suggested default, could be configurable per clan

## 4. Dependencies

- Heartbeat fallback system (implemented)
- Cross-user price pool via watchSymbols/marketPrices (implemented)
- Trade evaluator with candle-based evaluation (implemented)
- Price crossing detection: compare fallback price against trade's SL/TP fields

## 5. Files likely involved

- `src/services/heartbeat-fallback.service.ts` — detect price crossing SL/TP
- `src/services/trade-evaluator.service.ts` — auto-evaluate after timeout
- `src/services/ea-signal-close.service.ts` — close flow
- `src/services/notification-triggers.ts` — new notification type for advisory message

## 6. Edge cases

- User reconnects between advisory message and auto-evaluation → EA close event takes priority, cancel evaluation
- Multiple partial closes — evaluator may not handle partial close correctly
- Weekend price gaps — SL/TP may be hit at a gap price, not exact level
- User deletes account while trade is in ghost state
- Symbol delisted from broker while trade is in ghost state

## 7. Not in scope

- Building a symbol alias map for cross-broker naming (separate task)
- Real-time SL/TP monitoring (we only check every 30s in fallback)

## 8. Change notes

- 2026-03-14: Task created from discussion about fallback system limitations
