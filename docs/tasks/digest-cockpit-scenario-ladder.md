# Task Brief — Digest Cockpit Redesign + Interactive Scenario Ladder

> Started: 2026-03-17
> Status: IN_PROGRESS

## 1. Goal

Transform the Activity Digest from a health-taxonomy display into a **one-glance trading cockpit**, and upgrade the static Price Ladder into an **interactive scenario tool** that answers "what happens if price goes to X?"

## 2. Why it exists

The current digest v2 has all the data engines (14 pure-function engines, health model, tracking, concentration, risk budget) but the UX still feels like a health taxonomy rather than a trading cockpit. Traders need to:
- See floating P/L + R + risk at a glance (Right Now)
- See today's realized results (Today)
- Answer "if price goes here, what happens?" (Scenario Ladder)
- Know where to place SL to cap risk at 1%/2%/5% (Define My Risk)

MetaTrader already shows current state. ClanTrader's value is showing **what would happen if**.

## 3. Current decisions

- Safety tag `pre-digest-cockpit-redesign` created as rollback point
- Feature branch: `feature/digest-cockpit-scenario-ladder`
- Extends existing task brief `docs/tasks/activity-digest.md` (Phases 1-10 complete)
- Start-of-day drift: DEFERRED — no dedicated daily snapshot model exists. Can reconstruct from first EquitySnapshot of period but not precise enough.
- Scenario ladder math: pure functions in `src/lib/price-ladder-scenarios.ts`, separate from UI
- Pain levels: -1%, -2%, -5%, -10% (extends current -10%/-20%/-50%)
- Balance and equity are available via `riskBudget.totalEquity` / `riskBudget.totalBalance`
- V2 is already the default digest path (no feature flag toggle needed)

## 4. Rules touched

- Price ladder level types expanded (pain levels, scenario marker)
- Digest cockpit data flow (Right Now / Today panel structure)
- Attention queue dedup rules (group tracking-lost by member)
- Member/trade row display priority (numbers first, health secondary)
- No-SL mode: ladder emphasizes pain levels + suggested SL instead of just warning

## 5. Files / systems involved

| File | Change |
|------|--------|
| `src/lib/price-ladder-scenarios.ts` | NEW — Pure scenario math functions |
| `src/lib/digest-engines.ts` | Extend price ladder with pain levels + scenario support |
| `src/components/chat/DigestSheetV2.tsx` | Major refactor: cockpit panels, interactive ladder, member/trade rows |
| `src/messages/en.json` | New i18n keys for scenario ladder, cockpit panels |
| `src/messages/fa.json` | Persian translations |
| `src/lib/open-trade-health.ts` | Attention queue dedup improvements |
| `docs/tasks/digest-cockpit-scenario-ladder.md` | This brief |
| `docs/testing/digest-cockpit-scenario-ladder-test-plan.md` | Test plan |

## 6. Edge cases

- No balance/equity available → skip pain levels, show "Balance unavailable"
- No valid SL on any trade → enter Unprotected Scenario Mode (emphasize pain levels)
- R not computable → still show P/L, badge "Risk Unknown"
- Mixed computable/non-computable R → show known portion + "X trades with unknown risk"
- Zero lots → skip scenario calculations
- Negative prices from pain level math → hide those levels
- Single trade vs multi-trade ladder → different context line
- Tracking lost → do not generate price-sensitive conclusions
- Very small account → pain level prices may be very close to current price
- Scenario price outside realistic range → clamp to 0.2x-2.0x current price

## 7. Manual test scenarios

See `docs/testing/digest-cockpit-scenario-ladder-test-plan.md`

## 8. Done definition

The digest is done when a trader can:
1. Open it and immediately see: floating P/L, floating R, open risk, actions needed, today result
2. Drag a scenario marker on the ladder and see projected P/L, % of balance/equity, projected R
3. See account pain levels (-1%, -2%, -5%, -10%) on the ladder
4. Use quick-jump chips to jump to key levels
5. For unprotected trades: see where to place SL to cap risk at 1%/2%/5%
6. Member rows show useful numbers (P/L, R, risk, actions) not just health labels
7. Trade rows show P/L prominently with health demoted to secondary
8. Attention queue is concise (max 5, deduped, grouped)
9. All text is i18n'd (en + fa), RTL works, mobile works

## 9. Open questions

- Should scenario ladder support direct price input via text field? (Start with drag-only, add input if clean)
- Should pain levels include positive levels (+1%, +2%, +5%)? (Yes if easy)
- Precise format for "Define My Risk" mode — chip toggles vs dropdown?

## 10. Change notes

### 2026-03-17 (Task started)
- Audit completed: digest v2 has 14 engines, all metrics available, but UX leads with health taxonomy
- Current ladder: static SVG thermometer with levels but no interactivity
- Balance/equity available via riskBudget (totalEquity, totalBalance)
- Start-of-day snapshots: NO dedicated model, deferred
- Feature branch + safety tag created
