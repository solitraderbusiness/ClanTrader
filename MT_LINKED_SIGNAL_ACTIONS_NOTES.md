# MT-Linked Signal Card Actions (Mode A)

## What Changed

MT-linked trades (where ClanTrader signals are matched to MetaTrader trades via the EA) now route execution actions through the EA instead of applying instant DB updates. MetaTrader is the source of truth for trade state; ClanTrader is the social + control layer.

## Action Behavior by Type

| Action | MT-linked | Non-MT |
|--------|-----------|--------|
| Set BE | Sent to EA → OrderModify | Instant DB update |
| Move SL | Sent to EA → OrderModify | Instant DB update |
| Change TP | Sent to EA → OrderModify | Instant DB update |
| Close | Sent to EA → OrderClose | Instant DB update (UNVERIFIED) |
| Add Note | Instant (chat-only, no MT) | Instant |
| Change Status | Hidden for MT-linked | Instant DB update |

## Key Difference: Close Action

- **Non-MT close**: `integrityStatus: UNVERIFIED`, `statementEligible: false`, `resolutionSource: MANUAL`
- **MT-linked close**: `integrityStatus: VERIFIED`, `statementEligible: true`, `resolutionSource: EA_VERIFIED`
  - EA-confirmed close IS statement-eligible because MetaTrader executed it

## Pending Action Lifecycle

1. User clicks action on MT-linked card
2. Server creates `EaPendingAction` (status: PENDING, 5-minute expiry)
3. UI shows pulsing "Pending..." badge
4. EA picks up action on next heartbeat (piggybacked on response)
5. EA executes `OrderModify`/`OrderClose` in MetaTrader
6. EA reports result via `POST /api/ea/actions/{id}/result`
7. Server updates DB + notifies UI via socket
8. UI shows success (badge clears) or error (error badge with tooltip)

## Timeout

Actions expire after **5 minutes**. If the EA doesn't pick up or report back within this window, the action status becomes `TIMED_OUT` and the pending badge clears on next heartbeat.

## Permission Model

- **MT execution actions** (Set BE, Move SL, Change TP, Close): owner-only
- **Add Note**: open to anyone with base clan permissions
- **Change Status**: hidden from menu for MT-linked trades (preserved for legacy non-MT)

## Backward Compatibility

- Non-MT trades: completely unchanged behavior
- Existing EAs: ignore extra `pendingActions` field in heartbeat response (forward compatible)
- `Trade.mtLinked` defaults to `false` — only set when signal-matcher links a trade

## Database Changes

- New model: `EaPendingAction` (pending action queue)
- New field: `Trade.mtLinked` (boolean, default false)
- New enum: `EaActionStatus` (PENDING, SENT, EXECUTED, FAILED, TIMED_OUT)
- New relation: `MtAccount.pendingActions`
