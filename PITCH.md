# ClanTrader — Investor Overview

**Competitive Social Trading for the Iranian Market**

ClanTrader is a real-time social trading platform where verified traders form clans, compete in seasons, and build public track records — with fraud-resistant performance verification powered by a direct MetaTrader bridge.

---

## The Problem

1. **No trust in trading claims**: Social media is full of traders posting fake P&L screenshots. There's no way to verify if someone is actually profitable.
2. **No competitive structure**: Traders operate in isolation. There's no organized way to compete, compare, or build a public reputation.
3. **Iran-specific constraints**: International platforms (Myfxbook, TradingView social) are unreliable or inaccessible. Iranian traders need infrastructure that works during internet restrictions and over cellular networks.

## The Solution

ClanTrader solves all three:

- **Verified performance** — A proprietary MetaTrader Expert Advisor (EA) bridges live trades directly from MT4/MT5 to the platform. Every entry, stop loss, take profit, and close is cryptographically timestamped and immutably recorded. No screenshots, no self-reporting — just real trades.
- **Clan-based competition** — Traders form teams (clans), post signals in real-time chat, and compete on seasonal leaderboards across six ranking dimensions.
- **Iran-first architecture** — Phone-first auth via Kavenegar SMS (works over cellular during blackouts), all fonts self-hosted, live price caching survives market closures, zero dependency on international APIs at runtime.

---

## Key Features

### MetaTrader Bridge (EA)
- Proprietary MQ4/MQ5 Expert Advisor files for MT4 and MT5
- Automatic trade detection: open, modify SL/TP, close — all synced in real time
- Signal cards auto-created in clan chat when a trade opens in MetaTrader
- Live R:R (risk-to-reward) and P&L pushed to all clan members via WebSocket
- Two-way control: users can set break-even, move SL/TP, or close trades from the web UI — the EA executes in MetaTrader

### Trade Integrity Engine
- Immutable snapshots of initial entry, stop loss, take profit, and risk on trade creation
- Version-controlled trade card edits with full audit trail
- Integrity status tracking: `VERIFIED` / `UNVERIFIED` with reason codes
- Automated evaluator service flags suspicious modifications
- Only verified, integrity-passed trades count toward rankings and statements

### Clan System
- Create or join clans (public or invite-only)
- Role hierarchy: Leader, Co-Leader, Member
- Real-time chat with topics/channels per clan
- Signal cards and analysis cards posted inline in chat
- Clan performance dashboard with win rate, profit factor, avg R, instrument breakdown
- Activity digest: per-member trade breakdown by period
- Public channel feed visible to followers (non-members)

### Real-Time Chat
- Socket.io powered: messages, reactions, typing indicators, presence
- Trade cards rendered inline with live R:R updates
- Image attachments, reply threading, pinned messages
- Direct messages between any two users
- AI-powered topic summaries

### Leaderboards & Seasons
- Admin-created competitive seasons with start/end dates
- Six ranking lenses: Composite, Profit, Consistency, Risk-Adjusted, Low-Risk, Activity
- Configurable scoring weights — prevents gaming via a single metric
- Minimum trade threshold ensures statistical significance
- Badge rewards for season placement (top 3)

### Badge & Reputation System
- **Rank badges**: tiered progression (Rookie to Elite) based on verified trade count
- **Performance badges**: rolling-window metrics (net R, avg R, win rate, max drawdown)
- **Trophy badges**: season placement awards
- Displayed on profiles and in chat — builds portable reputation

### Trader Statements
- Auto-computed performance summaries per user/clan (monthly, seasonal, all-time)
- Metrics: signal count, win rate, avg R, best/worst R, total R, instrument/direction distribution
- Recalculated on every trade close
- Broker statement upload with admin verification flow

### Paywall & Monetization (Ready)
- Admin-configurable paywall rules: hide entry/SL/TP on auto-posted signals for free users
- Subscription plans with IRR pricing (monthly/yearly intervals)
- Premium channel posts
- Infrastructure ready for ZarinPal payment integration

### Referral System
- Personal invite links with tracking (clicks, signups, subscriptions)
- Admin dashboard with conversion funnels and top referrers
- Built for viral growth within Iranian trading communities

### PWA & Mobile
- Progressive Web App with offline support
- Service worker caching: static assets, fonts, images, pages
- Mobile-optimized bottom navigation
- Installable on iOS and Android home screens

### Internationalization
- Persian (fa), English (en), Arabic (ar)
- Full RTL support with logical CSS properties
- Self-hosted Persian and English fonts with per-user selection
- Adjustable display zoom (5 levels)

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI Components | shadcn/ui + Radix UI |
| Real-time | Socket.io 4.8 (custom server) |
| Database | PostgreSQL 16 + Prisma ORM 7 (26+ models) |
| Cache | Redis 7 (prices, presence, rate limiting, OTP) |
| Auth | Auth.js v5 with JWT sessions, SMS OTP via Kavenegar |
| Testing | Playwright E2E (admin-triggered, 3 suites) |
| Hosting | Dual VPS: US (dev/build) + Iran (staging + production) |

---

## Architecture Highlights

- **Iran-first resilience**: SMS OTP works over cellular during internet blackouts. All assets self-hosted. Price cache persists through weekends. Build on US server, deploy pre-built tarball to Iran — no npm/git needed on production.
- **Fraud-resistant by design**: Trades verified at the data layer, not the UI layer. Initial risk immutably snapshotted. Edit history preserved. Rankings computed only from verified trades.
- **Real-time everything**: Live R:R, typing indicators, trade status changes, presence — all pushed via WebSocket with Redis-backed rate limiting.
- **Admin-powered QA**: Feature flags, Playwright test runner, badge dry-runs, impersonation, audit logs — all from the admin panel.

---

## Development Status

| Phase | Status |
|-------|--------|
| Auth & Profiles | Complete |
| Statements & Verification | Complete |
| Clans & Real-time Chat | Complete |
| Leaderboards & Seasons | Complete |
| Content & Channels | Complete |
| AI Features (AIRouter) | Not Started |
| Payments (ZarinPal) | Not Started |
| Polish & Launch | In Progress |

The platform is feature-complete for core trading functionality. Remaining work is payment integration and AI-powered features (trade analysis, market summaries).

---

## Market Opportunity

- **Iran's retail forex market**: Estimated 500K+ active retail traders despite regulatory ambiguity. Growing rapidly with younger demographics entering the market.
- **Trust gap**: No existing platform verifies trade performance in a fraud-resistant way for the Iranian market. Self-reported results are the norm.
- **Community demand**: Iranian trading Telegram groups have 10K-100K+ members each, but lack structured competition, verification, and reputation systems.
- **Monetization**: Premium subscriptions (signal access), clan tier upgrades, future AI features — all priced in IRR via ZarinPal (Iran's dominant payment gateway).

---

## Contact

ClanTrader is built and operated by a solo technical founder with full-stack expertise across the entire platform — from the MetaTrader EA (MQL4/5) to the real-time WebSocket infrastructure to the React frontend.

- **Website**: [clantrader.ir](https://clantrader.ir) (production) | [clantrader.com](https://clantrader.com) (dev)
