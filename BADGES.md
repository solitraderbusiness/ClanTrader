# Badges & Ranking System

ClanTrader's anime guild-style badges system with three categories: **Rank badges**, **Performance titles**, and **Competition trophies**.

## Badge Categories

### Rank Badges
Trade count ladder. Exactly ONE active rank badge per user at a time (the highest qualifying).

| Key | Name | Min Trades |
|-----|------|-----------|
| rank-bronze | Bronze | 10 |
| rank-silver | Silver | 25 |
| rank-gold | Gold | 50 |
| rank-platinum | Platinum | 100 |
| rank-a | A | 250 |
| rank-s | S | 500 |
| rank-ss | SS | 1,000 |
| rank-sss | SSS | 2,500 |
| rank-divine | Divine | 5,000 |

### Performance Titles
R-multiple metrics over a sliding window. Multiple can be active simultaneously.

| Key | Name | Metric | Window | Threshold |
|-----|------|--------|--------|-----------|
| perf-sharpshooter | Sharpshooter | win_rate | 100 | >= 0.6 |
| perf-r-machine | R-Machine | net_r | 50 | >= 10 |
| perf-steady-hands | Steady Hands | max_drawdown_r | 100 | <= 8 |
| perf-consistent | Consistent | avg_r | 100 | >= 0.2 |

### Competition Trophies
Season leaderboard position. Awarded based on seasonal rankings.

| Key | Name | Lens | Rank Range |
|-----|------|------|-----------|
| trophy-champion | Season Champion | composite | 1-1 |
| trophy-top3 | Podium Finish | composite | 1-3 |

## requirementsJson Schemas

### Rank
```json
{
  "type": "rank",
  "min_closed_trades": 50
}
```

### Performance
```json
{
  "type": "performance",
  "metric": "net_r",      // net_r | avg_r | max_drawdown_r | win_rate
  "window": 50,           // number of recent trades to evaluate
  "op": ">=",             // >= | <= | > | <
  "value": 10
}
```

### Trophy
```json
{
  "type": "trophy",
  "season_id": "*",       // "*" = most recent ACTIVE/COMPLETED season
  "lens": "composite",    // composite | profit | low_risk | consistency | risk_adjusted | activity
  "rank_min": 1,
  "rank_max": 3
}
```

### Manual / Other
```json
{
  "type": "manual"
}
```

## Signal Validity Rules

A trade signal is **valid** for badge evaluation if:

1. The trade has reached a resolved status (TP1_HIT, TP2_HIT, SL_HIT, BE, CLOSED)
2. The trade card has NOT had its **entry** or **stopLoss** edited via TradeCardVersion
3. SET_BE and MOVE_SL actions (via TradeEvent) do NOT invalidate the signal
4. The original SL is recovered from the first TradeEvent when SET_BE/MOVE_SL modified it

## R-Multiple Calculation

```
risk = |entry - stopLoss|

TP1_HIT:  |targets[0] - entry| / risk
TP2_HIT:  |targets[1] - entry| / risk
SL_HIT:   -1
BE:        0
CLOSED:    0
```

## Admin Controls

### Badge Management (`/admin/badges`)
- Create, edit, enable/disable, soft-delete badge definitions
- Reorder rank ladder with up/down arrows
- Upload custom badge icons (128x128 WebP)
- Filter by category, enabled status, show/hide deleted

### Recompute & Dry-run (`/admin/badges/recompute`)
- **Recompute User**: Re-evaluate all badges for a specific user
- **Recompute Badge**: Re-evaluate a specific badge for all users
- **Global Recompute**: Re-evaluate all badges for all users (async with progress tracking)
- **Dry-run**: Preview impact of changing badge thresholds (shows who would gain/lose)

### Audit Trail (`/api/admin/badges/audit`)
- Every badge definition change is logged in BadgeAdminChange
- changeType: created, updated, enabled, disabled, deleted, restored, reordered
- Old/new values stored as JSON for full traceability

## Backfill

To evaluate badges for all existing users:

```bash
npx tsx scripts/backfill-badges.ts
npx tsx scripts/backfill-badges.ts --offset=100  # resume from offset
npx tsx scripts/backfill-badges.ts --batch=25     # custom batch size
```

## Trigger Points

Badge evaluation is triggered automatically:
1. **Trade closed/resolved** — via `trade-action.service.ts` after CLOSE or STATUS_CHANGE to resolved status
2. **Trade card edited** — via `trade-card.service.ts` after `editTradeCard()` if trade exists
3. **Rankings calculated** — via `ranking.service.ts` after `calculateRankings()` for trophy badges

All triggers are fire-and-forget to avoid blocking the main operation.

## Icon Management

Badge icons are uploaded to `public/uploads/badge-icons/` via the admin API:
- Supported formats: JPEG, PNG, WebP, SVG
- Raster images are resized to 128x128 and converted to WebP
- SVG files are stored as-is
- Max file size: 2MB

## Database Models

- **BadgeDefinition** — Admin-configurable badge templates
- **UserBadge** — Awarded badges per user (unique per user+badge, soft-deactivate)
- **BadgeAdminChange** — Structured audit trail for badge definition changes
