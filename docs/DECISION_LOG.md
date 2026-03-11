# Decision Log — ClanTrader

Running log of in-progress decisions captured during task work.
Newest entries first.

---

## 2026-03-11 — Activity Digest 5-engine architecture

- **Task:** activity-digest
- **Decision:** Implement 5 decision engines (State, Delta, Severity, Actions, Impact) as pure functions in a single file (`digest-engines.ts`)
- **Why:** Pure functions with no DB/Redis access are fully unit-testable, composable, and don't add coupling. The service wires data in, engines compute, route adds per-user deltas.
- **Affected files/rules:** `src/lib/digest-engines.ts`, `src/services/digest-v2.service.ts`, `src/app/api/clans/[clanId]/digest/route.ts`
- **Needs SOURCE_OF_TRUTH update now?:** yes — material feature addition to Activity Digest
- **Needs manual testing?:** yes — safety/confidence scores, deltas, alerts, actions, member impact all need live data verification

## 2026-03-11 — Per-user Redis snapshots for digest deltas

- **Task:** activity-digest
- **Decision:** Store per-user digest snapshots in Redis (key: `digest-snap:{clanId}:{userId}:{period}`, TTL: 24h) for delta comparison. Digest data itself uses shared 90s cache; deltas are computed per-user at route level.
- **Why:** Different users check at different times. Shared deltas would be meaningless. Per-user snapshots are lightweight (~500 bytes each) and Redis is already available.
- **Affected files/rules:** `src/app/api/clans/[clanId]/digest/route.ts`, `src/lib/digest-constants.ts`
- **Needs SOURCE_OF_TRUTH update now?:** no — covered by the engine architecture decision above
- **Needs manual testing?:** yes — first load baseline, second load deltas, period tab independence

## 2026-03-11 — Member impact score excludes zero-total dimensions

- **Task:** activity-digest
- **Decision:** When computing member impact score, if the clan has 0 total for a dimension (e.g., 0 tracking-lost trades), that dimension is excluded from the weighted average instead of producing 1/1 = 100%.
- **Why:** Including zero-total dimensions would inflate impact scores for any member, even those with no issues. Exclusion produces truthful relative scores.
- **Affected files/rules:** `src/lib/digest-engines.ts` — `computeMemberImpactScore()`
- **Needs SOURCE_OF_TRUTH update now?:** no — implementation detail
- **Needs manual testing?:** yes — verify with clan that has no tracking-lost trades

---
