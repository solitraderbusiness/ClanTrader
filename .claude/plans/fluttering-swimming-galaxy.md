# Expandable MT Account Cards with Per-Account Statement Metrics

## Context

Users who connect their MetaTrader account see it listed in the "MetaTrader Accounts" section on their profile, but the cards are static — just broker, balance, equity, and trade count. There's no way to click on an account and see the detailed trading stats (the auto-generated `TradingStatement` from `mt-statement.service.ts`).

The "Verified Trading Stats" section in `ProfileCard` shows the **most recent** verified statement globally, but doesn't tie it to a specific MT account. With multiple accounts, users need to see per-account stats.

**Goal**: Make each MT account card clickable/expandable. When expanded, show the per-account `StatementMetrics` using the existing `MetricsDisplay` component.

---

## Implementation

### 1. Update Profile Page Query — `src/app/(main)/profile/[userId]/page.tsx`

Add `statements` to the `mtAccounts` select to fetch per-account auto-generated statements:

```ts
mtAccounts: {
  where: { isActive: true },
  select: {
    // ...existing fields...
    statements: {
      where: { verificationStatus: "VERIFIED", verificationMethod: "BROKER_VERIFIED" },
      take: 1,
      select: { extractedMetrics: true, verificationMethod: true },
    },
  },
}
```

Serialize the statement data alongside each account when passing to `MtAccountsSection`.

### 2. Update MtAccountsSection — `src/components/profile/MtAccountsSection.tsx`

- Add `statement` field to `MtAccountDisplay` interface (the per-account `extractedMetrics`)
- Make each card clickable with expand/collapse toggle (use `useState` for `expandedId`)
- When expanded, render `MetricsDisplay` component with the account's statement metrics
- Show a chevron icon indicating expandability
- If no statement (< 5 trades), show "Not enough trades for stats" when expanded

Reuse:
- `MetricsDisplay` from `src/components/statements/MetricsDisplay.tsx` — already handles all stat rendering
- `StatementMetrics` type from `src/types/statement.ts`
- `ChevronDown` from lucide-react for expand indicator

### 3. Remove unused `MtAccountStats` component

`src/components/profile/MtAccountStats.tsx` has a different interface than `StatementMetrics` and is never imported anywhere. Delete it — `MetricsDisplay` handles the same use case better.

---

## Files

### Modified (2)
| File | Change |
|------|--------|
| `src/app/(main)/profile/[userId]/page.tsx` | Add `statements` to mtAccounts query, serialize and pass to component |
| `src/components/profile/MtAccountsSection.tsx` | Make cards expandable, show `MetricsDisplay` with per-account metrics |

### Deleted (1)
| File | Reason |
|------|--------|
| `src/components/profile/MtAccountStats.tsx` | Unused, replaced by `MetricsDisplay` |

---

## Verification

```bash
npm run lint && npm run build
```

1. Profile with MT account + 5+ closed trades → click account card → expands to show full stats via MetricsDisplay
2. Profile with MT account + < 5 trades → click card → shows "Not enough trades" message
3. Click again → collapses back to compact view
4. "Verified Trading Stats" section in ProfileCard still works independently
