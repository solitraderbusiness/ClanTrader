Perform a full project documentation reconciliation and project-state refresh for ClanTrader.

## Workflow

### Phase 1: Audit

1. **Inventory all markdown files** — Scan `docs/`, `docs/archive/`, root `.md` files, `.claude/` configs, and memory files. For each file note: path, purpose, freshness, overlaps.

2. **Inspect codebase reality** — Check the current state of:
   - Prisma schema (`prisma/schema.prisma`) — models, fields, relationships
   - Key services (`src/services/`) — what's implemented vs stubbed
   - API routes (`src/app/api/`) — active vs empty route directories
   - Types (`src/types/`) — current type definitions
   - Feature flags, ranking constants, signal qualification logic

3. **Compare docs against code** — For each canonical doc, verify:
   - Are described features actually implemented?
   - Are implementation details (field names, logic, flows) accurate?
   - Are there new features in code not yet documented?
   - Are there deprecated features still described as active?

### Phase 2: Reconcile

Apply these rules strictly:

- **Code wins** for implemented behavior — if docs say one thing and code says another, update docs
- **Latest PM decisions win** for planned direction — check with user if unclear
- **Resolve contradictions** — never leave two docs disagreeing
- **Archive, don't delete** — move stale docs to `docs/archive/` with deprecation banner
- **Keep canonical docs small** — prefer fewer strong docs over many overlapping ones

### Phase 3: Update

1. **Update stale canonical docs** — Fix inaccuracies, remove outdated sections, add missing info
2. **Archive newly stale docs** — Move to `docs/archive/` with deprecation header:
   ```
   > **ARCHIVED** — [reason]. See [canonical doc] for current information.
   > Last Verified: YYYY-MM-DD | Status: Archived
   ```
3. **Update `docs/README.md`** — Refresh the canonical docs index table
4. **Update `CLAUDE.md`** — Ensure it reflects:
   - Current product architecture (single statement page, signal qualification, integrity contract)
   - Current MVP scope and what's excluded
   - Accurate services map
   - Accurate docs map
   - Correct vocabulary
   - Current infrastructure
5. **Update memory files** — Refresh `~/.claude/projects/-root-projects-clantrader/memory/MEMORY.md` if project state has changed

### Phase 4: Report

Summarize back to the user:

1. **Docs audit summary** — files updated, archived, created
2. **Contradictions resolved** — what conflicted and how it was fixed
3. **CLAUDE.md changes** — what was updated
4. **Unresolved uncertainties** — items needing manual product confirmation
5. **Code/features used as source of truth** — what codebase evidence informed changes

## Key Product Rules to Verify

These are the current ClanTrader product decisions. Ensure all docs align:

- **Single public statement page** with three layers: official closed performance, live open risk, effective rank
- **Signal qualification**: 20-second window, frozen official risk snapshot, AT_OPEN or WITHIN_WINDOW origin
- **Integrity contract**: 7-condition deny-by-default for statement eligibility
- **Effective rank**: `closedOfficialR + openLossPenaltyR` (open gains don't help, open losses penalize)
- **Multiple MT accounts**: all feed one public statement per clan
- **Analysis-origin trades**: journal/digest only, never statements/leaderboard
- **NOT in MVP**: broker history import, manual statement upload, public per-account statements

## Consistent Vocabulary

Enforce these terms across all docs:
- official signal-qualified trade
- analysis-origin trade
- official closed performance
- live open risk
- effective rank
- frozen risk snapshot
- statement-eligible
- MT account

## Tips for Efficient Execution

- Use the Explore agent for codebase inspection (avoids filling main context)
- Use parallel agents when auditing docs and code simultaneously
- Read schema first — it's the fastest way to verify model/field reality
- Check `docs/archive/` so you don't re-archive already-archived docs
- Keep CLAUDE.md under ~200 lines — it's loaded into every conversation
