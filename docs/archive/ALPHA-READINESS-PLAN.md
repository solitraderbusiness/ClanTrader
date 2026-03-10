> **ARCHIVED** — Sprint plan snapshot (March 2026). Work described here has been completed or superseded.
> See [docs/MVP.md](../MVP.md) for current launch scope.
> Last Verified: 2026-03-10 | Status: Archived

---

# Alpha Readiness Plan — ClanTrader

> **Generated**: 2026-03-04
> **Auth strategy**: Email-only (no Kavenegar SMS OTP)
> **Timeline**: 8 weeks (W1-W4 pre-alpha + W5-W8 post-alpha)
> **Capacity**: Solo founder, ~6h/day

## Executive Summary

- **Open launch blockers**: 26
- **Deferred tasks**: 3 (phone OTP, Kavenegar, OpenRouter)
- **Phase system**: W1-W8 weekly sprints (replaces P1-P16 feature phases)

### Effort Estimate (blocker tasks only)

| Scenario | Hours | Days (6h/day) |
|---|---|---|
| Best case | 93h | 16 days |
| Likely | 170h | 29 days |
| Worst case | 274h | 46 days |

---

## Weekly Sprint Plan

| Week | Name | Focus | Testable Milestone |
|---|---|---|---|
| W1 | Infrastructure | VPS, deploy, SMTP, backups, rate limits | App runs on Iran VPS, emails send |
| W2 | Auth & Mobile | Email verification, password reset, mobile polish | Auth works on mobile, all modals close |
| W3 | Security & QA | Security audit, integrity tests, QA all flows, fix rounds | All critical flows pass QA |
| W4 | Alpha Launch | Final regression, invite batch, go-live | 10 traders are using the platform |
| W5 | Alpha Monitoring | Bug fixes, stability, uptime monitoring | No critical bugs for 48h |
| W6 | Post-Alpha | Triage feedback, quick wins, plan next features | Roadmap for W7-W8 decided |
| W7 | Feature Sprint 1 | TBD from alpha feedback (likely payments or phone OTP) | TBD |
| W8 | Feature Sprint 2 | Future backlog (parked tasks) | TBD |

---

## Day-by-Day Timeline

| Day | Week | Tasks | Hours | Notes |
|---|---|---|---|---|
| Day 1 | W1 | Iran VPS setup | 6h | Pre-req: order VPS before Day 1 |
| Day 2 | W1 | Deploy pipeline to Iran, /api/health endpoint | 6h | Health endpoint ~1h, deploy pipeline ~5h |
| Day 3 | W1 | SMTP production setup, Zod env validation | 6h | Critical for email-only auth |
| Day 4 | W1 | Automated backups (pg_dump cron) | 6h | Daily cron, 7-day retention |
| Day 5 | W1 | Restore drill | 6h | Drop → restore → verify (generous buffer) |
| Day 6 | W1 | Rate limiting on public routes | 6h | Extend existing Redis rate limiter |
| Day 7 | W1 | Buffer / GlitchTip | 6h | Deploy GlitchTip if no infra issues; otherwise buffer |
| Day 8 | W2 | Email verification + password reset on staging | 6h | Already built — verify with real SMTP |
| Days 9-10 | W2 | Mobile responsive polish | 12h | Finish Telegram-like mobile layout |
| Day 11 | W2 | Mobile audit on real devices | 6h | iPhone Safari + Android Chrome |
| Day 12 | W2 | Modals/sheets on mobile | 6h | All dialogs closable on mobile |
| Day 13 | W2 | Signal cards mobile | 6h | R:R cards readable on narrow screens |
| Day 14 | W2 | Buffer | 6h | Catch-up day + verify landing page on Iran |
| Day 15 | W3 | Security audit (alpha basics), Prepare QA accounts, Verify onboarding | 6h | Scoped: auth checks, IDOR, uploads, rate limits |
| Day 16 | W3 | Integrity E2E test, Exploit regression tests | 6h | All 6 integrity conditions verified |
| Day 17 | W3 | QA: Auth flows, QA: Clans + chat + topics | 6h | Use multiple test accounts |
| Day 18 | W3 | QA: Trade cards + signals + DMs, QA: Admin + leaderboards | 6h | Complete QA coverage |
| Days 19-20 | W3 | QA fix round 1 | 12h | Critical bugs first |
| Day 21 | W3 | Buffer / QA fix round 2 | 6h | Re-test fixes, address remaining issues |
| Day 22 | W3 | Final regression + production deploy | 6h | Go/no-go decision |
| Day 23 | W4 | Alpha invite batch | 6h | 10-20 traders, 2-3 curated clans |
| Days 24-34 | W4+ | Alpha monitoring + bug fixes | ~60h | 2-week alpha feedback period |

---

## Launch Blockers

26 tasks must be completed before alpha launch:

| # | Key | Week | Status | Priority | Title | Est (h) |
|---|---|---|---|---|---|---|
| 1 | auth.email-verification | W2 | TESTING | CRITICAL | Email verification flow | 2/4/6 |
| 2 | auth.password-reset | W2 | TESTING | HIGH | Password reset flow | 1/3/5 |
| 3 | ops.security-audit | W3 | BACKLOG | CRITICAL | Security audit (OWASP top 10) | 4/6/10 |
| 4 | ops.mobile-responsive | W2 | IN_PROGRESS | HIGH | Mobile responsive polish | 8/12/16 |
| 5 | stabilize.mobile-audit | W2 | BACKLOG | CRITICAL | Mobile audit | 4/6/8 |
| 6 | stabilize.signal-cards-mobile | W2 | BACKLOG | CRITICAL | Signal cards readable on mobile | 3/5/8 |
| 7 | stabilize.modals-mobile | W2 | BACKLOG | HIGH | Modals and sheets on mobile | 3/5/8 |
| 8 | stabilize.integrity-e2e | W3 | BACKLOG | CRITICAL | Manual E2E integrity test | 3/5/8 |
| 9 | stabilize.alpha-invite | W4 | BACKLOG | CRITICAL | Alpha invite batch | 2/4/6 |
| 10 | stabilize.alpha-bugfix | W4 | BACKLOG | CRITICAL | Alpha bug-fix buffer | 12/30/60 |
| 11 | stabilize.error-tracking | W1 | BACKLOG | CRITICAL | Self-hosted error tracking (GlitchTip) | 3/6/10 |
| 12 | stabilize.exploit-regression | W3 | BACKLOG | CRITICAL | Exploit regression tests | 2/4/6 |
| 13 | stabilize.iran-vps | W1 | TODO | CRITICAL | Iran VPS setup | 4/6/10 |
| 14 | stabilize.deploy-iran | W1 | TODO | CRITICAL | Deploy pipeline to Iran end-to-end | 4/6/8 |
| 15 | stabilize.health-endpoint | W1 | TODO | HIGH | /api/health endpoint | 1/2/3 |
| 16 | stabilize.smtp-prod | W1 | TODO | CRITICAL | SMTP for production email | 3/6/8 |
| 17 | stabilize.env-validation | W1 | TODO | HIGH | Zod env validation at startup | 1/2/4 |
| 18 | — | W3 | BACKLOG | CRITICAL | QA: Auth flows (signup, login, verify, reset) | 3/5/8 |
| 19 | stabilize.db-backups | W1 | TODO | CRITICAL | Automated PostgreSQL backups | 6/10/14 |
| 20 | — | W3 | BACKLOG | CRITICAL | QA: Clans + chat + topics | 3/5/8 |
| 21 | stabilize.rate-limits | W1 | TODO | CRITICAL | Rate limiting on all public routes | 3/5/8 |
| 22 | — | W3 | BACKLOG | CRITICAL | QA: Trade cards + signals + DMs | 3/5/8 |
| 23 | — | W3 | BACKLOG | HIGH | QA: Admin panel + leaderboards | 2/4/6 |
| 24 | — | W3 | BACKLOG | CRITICAL | QA fix round 1 | 6/12/18 |
| 25 | — | W3 | BACKLOG | HIGH | QA fix round 2 | 3/6/12 |
| 26 | — | W3 | BACKLOG | CRITICAL | Final regression + staging deploy | 4/6/8 |

---

## Deferred Tasks (Not Alpha Blockers)

These tasks are intentionally deferred for alpha:

| Key | Title | Week | Reason |
|---|---|---|---|
| `auth.phone-otp` | Phone OTP signup/login | W7 | Email-only auth for alpha |
| `stabilize.kavenegar-prod` | Kavenegar OTP on Iran | W7 | Email-only auth for alpha |
| `market-data.openrouter-wrapper` | OpenRouter client wrapper | W8 | AI features not needed for alpha |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Iran VPS setup takes >1 day | Shifts all W1 tasks | Order VPS before Day 1; buffer on Day 7 |
| SMTP provider issues in Iran | No email auth | Test with multiple SMTP providers; have backup |
| Mobile bugs exceed Day 12-13 | Alpha with broken mobile | Days 14 + 21 are buffers; scope to critical flows only |
| QA reveals architectural issues | Major rework needed | Unlikely — core features already in TESTING/DONE |
| GlitchTip too resource-heavy | No error tracking | Fallback: PM2 logs + manual monitoring for 10 users |

---

## Assumptions

1. Solo founder works ~6h/day consistently
2. Iran VPS is ordered and SSH-accessible before Day 1
3. Email-only auth (no SMS OTP) for alpha
4. Alpha = 10-20 invited traders, 2-3 curated clans
5. GlitchTip is nice-to-have; PM2 logs are acceptable for 10 users
6. No new features during alpha — bug fixes only
