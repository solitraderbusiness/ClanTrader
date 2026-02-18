
# CLANTRADER



Complete Project Development Plan

Iranian-First Infrastructure  |  Blackout-Resilient Architecture

Solo Build with Claude Code  |  February 2026  |  Version 3.0

# CONFIDENTIAL

Executive Summary
ClanTrader is a competitive social trading platform where every user is verified by real trading statements. Traders form clans (teams of 3-6), compete in monthly seasons, share content, and build verified reputations.




Iranian-First Architecture
The platform runs on a dual-layer system: the Iranian Core (always available) and the International Enhancement Layer (available when global internet is accessible).

Layer 1: Iranian Core (Always Available)
These services run entirely on Iranian servers within the NIN. They require zero international connectivity.


Layer 2: International Enhancement (When Available)
These services improve the experience when international internet is accessible. They degrade gracefully when unavailable.


How the AI Failover System Works
The AI system has an automatic failover chain. When a user sends a query, the system tries each level in order until one responds:

Level 1 (Default): OpenRouter API → routes to Claude Sonnet, GPT-4o, or Gemini based on query type and cost. This gives the highest quality answers. Used when international internet is available.
Level 2 (Auto-failover): Local Ollama server running Mistral 7B (quantized Q4). If the OpenRouter API call fails or times out after 3 seconds, the system automatically routes the query to the local model. The user sees a small indicator: "⚡ Running in local mode" but the experience continues seamlessly.
Level 3 (Emergency cache): Pre-computed responses for the 50 most common queries. If even the local LLM is under heavy load, the system serves cached answers for questions like "top clans this week" or "most traded pairs." Updated every hour when any AI is available.




Server Infrastructure
Recommended Iranian Hosting Providers
Based on research into reliability, support quality, developer features, and NIN stability during recent shutdowns:


Server Setup: Three Servers

Server 1: Production Application Server (Iranian VPS)
This is the main server your users connect to. Runs the Next.js app, PostgreSQL, Socket.io, and Nginx.


Software stack: Node.js 20 LTS, PostgreSQL 16, Nginx (reverse proxy + SSL), PM2 (process manager), Redis (caching + session store), Socket.io (realtime).

Server 2: AI / LLM Server (Iranian VPS or Dedicated)
Runs Ollama with open-source models. This is the fallback AI that keeps working during blackouts. Can be the same server as production if budget is tight, but a separate server is strongly recommended for performance.



Recommended Models for Ollama (Ranked)

Mistral 7B Instruct (Q4_K_M): Best balance of quality and speed. 4.1 GB on disk. Works great for structured queries. Apache 2.0 license.
Llama 3 8B Instruct (Q4_K_M): Slightly larger (4.9 GB) but better reasoning. Good for complex clan analysis queries.
Qwen 2.5 7B (Q4_K_M): Strong multilingual support including better Farsi understanding. Worth testing for your Persian-speaking users.
Phi-4 Mini 3.8B (Q4_K_M): Smallest option (~2.5 GB). Very fast even on CPU. Use this if your AI server is resource-limited.


Server 3: Dev Server (Iranian VPS)
Your development and testing environment. Can be a smaller, cheaper VPS from the same provider.


Dev server has its own PostgreSQL database with test/seed data
Same codebase as prod, deployed via Git 'develop' branch
All user testing before public launch happens here
Claude Code reminder in CLAUDE.md: never deploy untested code to production

Server Deployment Architecture

Development flow (Starlink-friendly, blackout-safe): Code locally with Claude Code → Push to GitHub (backup + version history) → Deploy to Iranian DEV via SSH/rsync → Test with beta users → Promote to PROD via SSH/rsync. Deployment does NOT require the Iranian servers to access GitHub (important during blackouts).
Optional local Git: self-host Gitea on the Iranian dev/prod server (or a separate local VPS). You can push to both GitHub (international backup) and Gitea (domestic). During blackouts, servers pull from Gitea inside NIN without touching international Git services.

Git branches: 'main' = production, 'develop' = dev server, feature branches for new work
Environment files: .env.development and .env.production control which database, APIs, and models are used
The AI server is shared between dev and prod (separate API keys for rate limiting)
Backups: Daily PostgreSQL dumps to a separate storage location on the same server

Monthly Infrastructure Cost Estimate





Development Approach: Iranian-First, Not Fallback


How This Works in Practice with Claude Code
For each phase, Claude Code builds the feature in this order:

Step 1: Build the core feature using only Iranian infrastructure (PostgreSQL, local storage, Socket.io, NextAuth). Test it. Make sure it works perfectly in isolation.
Step 2: Add the international enhancement on top (OpenRouter for AI, Myfxbook for verification). The enhancement connects through the AIRouter or a similar abstraction layer.
Step 3: Test the failover. Simulate a blackout by blocking international API calls. Verify the feature still works with the local/cached alternative.

This is NOT building each phase twice. It is building each phase once with a proper abstraction layer. The AI example makes this clear:

You build ONE AI chat interface for users
Behind it is ONE AIRouter class that accepts a query and returns a response
The AIRouter internally tries OpenRouter first, then Ollama, then cache
The UI does not know or care which backend answered the query
This is good software engineering regardless of the Iran situation — it makes the AI system resilient to any API outage
UI/UX Direction: Telegram Navigation DNA (Not a Telegram Clone)
Goal: reduce onboarding friction for Iranian users by borrowing Telegram Web's layout habits (left sidebar + right content panel, fast search, unread indicators) while making it obvious this is a competitive trading platform.
Key principle: Telegram's skeleton, ClanTrader's soul. Users should feel familiar in the first 3 seconds, then immediately discover trading-only features (verified stats everywhere, seasons, leaderboards, badges, AI in chat, stories with win-rate overlays).
Implementation notes:
- App shell: responsive two-panel layout like Telegram Web (desktop) and list -> view navigation (mobile).
- Left sidebar lists: clan private chats + followed clan channels, with search and unread badges.
- Channel view: Telegram-style broadcast posts (text/images/charts, reactions, view counts) with verified trader stats embedded under the author.
- Top bar: always shows current season status (days left), your clan rank, and quick access to leaderboard/discover.



Development Phases
Baseline estimated timeline: 18-20 weeks (~5 months). With an experienced developer using Claude Code full-time (5-10 hours/day), a realistic MVP launch target is 16-20 weeks (~4-5 months), assuming tight scope control.


Set up the entire project infrastructure on Iranian servers. Authentication, database, basic profiles. Everything runs locally from day one.

Infrastructure Setup
Provision production VPS from ParsPack (or ParsVDS). Install Ubuntu 22.04 LTS
Install and configure: Node.js 20, PostgreSQL 16, Nginx, PM2, Redis, certbot (SSL)
Register .ir domain (clantrader.ir) and configure DNS to point to Iranian VPS
Set up Nginx as reverse proxy with SSL termination
Initialize Next.js project with TypeScript, Tailwind CSS, shadcn/ui
Set up PM2 process management for zero-downtime deployments
Configure Git-based deployment (push to deploy)

Authentication & Profiles
Implement NextAuth.js with credentials provider (email + password)
Build signup, login, email verification, and password reset flows
Create user profile page (display name, bio, avatar, trading style, preferred pairs)
Build landing page explaining the platform concept

Database Schema
users (id, email, password_hash, name, bio, avatar, role, trading_style, session_preference, created_at)
trading_statements (id, user_id, file_path, verification_status, extracted_metrics JSONB, uploaded_at)
clans (id, name, description, avatar, created_by, tier, settings JSONB)
clan_members (id, user_id, clan_id, role, joined_at)
follows (id, follower_id, following_type, following_id)
seasons (id, start_date, end_date, status)
leaderboard_entries (id, season_id, entity_type, entity_id, metrics JSONB)



Build the trust layer. Statement upload and parsing is 100% local — no international API required. Myfxbook integration is an optional enhancement.

Core (Iranian Server Only)
Build statement upload UI (drag-and-drop, file validation, progress indicator)
Create MT4/MT5 HTML statement parser in Node.js (extract: total profit/loss, win rate, max drawdown, total trades, trading period, pairs traded, profit factor, Sharpe ratio)
Store parsed metrics in PostgreSQL JSONB field for flexible querying
Create verification status system (pending, verified, rejected, expired)
Build verified trader profile page showing parsed statistics
Create admin dashboard for manual verification review
Implement periodic re-verification prompts

Enhancement (When International Internet Available)
Myfxbook API integration (OAuth, fetch account data, periodic sync)
Mark profiles as "Self-reported" vs "Broker-verified" based on verification method
Auto-sync Myfxbook data when connection is available, cache locally



Build the complete clan system. Chat uses Socket.io on the Iranian server — fully functional during blackouts. This is the MAKE-OR-BREAK phase.

Core (Iranian Server Only)
Clan creation flow (name, description, avatar, trading focus, privacy settings)
Free agents page with filters (trading style, pairs, performance tier, risk level, session)
Clan invitation and join request system (invite link, request to join, approve/deny)
Clan profile page (members, combined stats, badges, description)
Clan management panel (add/remove members, edit details, assign roles: Leader, Co-Leader, Member)
Clan size limits (3 free, 6 pro) with upgrade prompts
Clan chat via Socket.io on Iranian server (messages, pinning, basic formatting)
Clan statement system (aggregate individual stats OR manual upload of combined account)
Clan channel (public broadcast feed, Telegram-style) tied to each clan (unlimited followers)
Channel posts: free + premium posts with access control (premium unlocks via subscription)
Subscriber chat: live chat for followers alongside the channel (pro/subscriber-only)
Option to link external Telegram group to clan profile page



Build the competitive layer. 100% local computation — all ranking data lives in PostgreSQL on the Iranian server.

Core (Iranian Server Only)
Individual trader leaderboard (sortable by multiple metrics, filterable by pair/style)
Clan leaderboard (combined performance, member count adjustments)
Season system (automatic monthly reset, archive past seasons in database)
Badge/tier system (Bronze, Silver, Gold, Diamond, Legendary)
Season results page (final standings, awards, highlights)
Live ranking movement indicators (arrows showing position changes)
Weekly snapshot highlights (biggest climber, most consistent, highest single trade)
Season History on trader and clan profiles (wall of badges over time)
Notification system for ranking changes and season events

Competition Categories
Overall Champion, Most Consistent, Best Risk Manager, Rising Star, Specialist Awards per instrument

Ranking Algorithm
Return % (40% weight) — primary performance metric
Risk-adjusted return / Sharpe ratio (25%) — rewards consistency
Maximum drawdown penalty (20%) — penalizes reckless risk
Trading activity (15%) — minimum activity threshold to prevent gaming


Content ecosystem is 100% local. Images and files stored on Iranian server disk. No CDN dependency.

Core (Iranian Server Only)
Story creation tool (image/chart upload, text overlay, 24hr expiry)
Stories viewer (tap-through format, verified badge + win rate visible on every story)
Home feed (stories bar + posts from followed clan channels + discovery/trending channels)
Clan channel view: Telegram-style post layout (text/images/charts, reactions, view counts)
Channel follow mechanics: follow channels for free; subscribe to unlock premium posts
Clan content library (permanent posts: tutorials, strategy guides, trade breakdowns)
Content creation editor (rich text, image embedding, chart markup tools)
Content library access control (free preview vs premium-only content)
Daily peek system (3 free premium post peeks per day for non-subscribers; resets daily)
Story analytics for pro users (views, taps, engagement rates)
Daily peek system (3 free clan visits per day, limited content preview for non-subscribers)




This is the most architecturally important phase. Build the AIRouter system that transparently handles failover between OpenRouter and local Ollama.

Step 1: Build the AIRouter Service
Create AIRouter class that accepts a query and returns a response
Implement provider chain: OpenRouter → Ollama → Cache
Add 3-second timeout for OpenRouter calls before falling to Ollama
Build health check that pings OpenRouter every 60 seconds to detect connectivity status
Create model config file: specify which OpenRouter model for which query type, which Ollama model as fallback
Implement response caching: cache every successful AI response in Redis with 1hr TTL
Build admin toggle to force local-only mode (useful during known shutdown periods)

Step 2: Set Up Local Ollama
Install Ollama on the AI server (dedicated Iranian VPS or dedicated machine)
Download models: Mistral 7B, Llama 3 8B, Qwen 2.5 7B, Phi-4 Mini (all Q4 quantized)
Configure Ollama to expose API on internal network (not public-facing)
Create system prompts optimized for each local model (shorter, more structured than cloud prompts)
Load test: simulate 10 concurrent queries on the local model to establish baseline performance

Step 3: Build AI Features
Spectator AI chatbot (chat interface, 3 free questions/day for non-pro users)
System prompt with database query access (top clans, trending instruments, trader search)
Clan AI assistant (@ai mention trigger in clan chat, pro-only feature)
Clan-specific context (members, stats, history) injected into clan AI prompts
Recruiting assistant ('Find us a free agent who trades gold with low drawdown')
Competitive intelligence ('Clan X just passed us, what changed?')
Weekly auto-generated clan performance summary (runs on schedule, uses cheapest available model)

Step 4: Optimize for Blackout Mode
Pre-compute and cache top-50 common platform queries every hour
Build a 'Platform Intelligence Snapshot' that runs daily: aggregates all clan stats, trending instruments, performance summaries into a JSON blob that the local AI can reference without database queries
Create simplified system prompts for Ollama that work with smaller context windows
Add a UI indicator for users: green dot = cloud AI, yellow dot = local AI, gray dot = cached responses



Payment integration uses Iranian gateways that work on NIN. No Stripe dependency for domestic users.

Iranian Payment Gateways


Tasks
Integrate ZarinPal as primary payment gateway (using their Node.js SDK)
Build Pro plan checkout flow (monthly and annual options, priced in Toman)
Create channel subscription marketplace UI (browse clan channels, preview free posts, subscribe for premium posts)
Channel pricing controls (each clan sets monthly price in Toman; optional daily/weekly passes later)
Build marketplace commission split (70-80% to clan, 20-30% platform)
Create revenue dashboard for clans (subscribers, earnings, payout history)
Build subscriber management for clans (view subscribers, engagement metrics)
Implement featured placement system (clans pay for boosted visibility)
Build billing management page (plan changes, payment history, cancel/resume)

Pricing Strategy (in Toman, adjust to market)
Pro Plan: ~500,000-900,000 Toman/month (~$10-18 at current rates)
Channel Subscription: set by clan, expected range 200,000-2,000,000 Toman/month
Daily Pass: 50,000-200,000 Toman
Featured Placement: 300,000-1,500,000 Toman/day



Final polish, the dev/prod split, staged user testing, and public launch.

Dev Server Setup
Provision separate Iranian VPS for dev environment (dev.clantrader.ir)
Deployment strategy: prefer SSH/rsync deploys from your development machine (Starlink) to dev/prod servers (works even if servers cannot reach GitHub). If you want Git-based deploys inside Iran, use self-hosted Gitea for domestic pulls; keep GitHub as international backup.
Set up separate PostgreSQL database with test/seed data on dev server
Verify all environment variables are correctly separated between dev and prod

Polish & Optimization
Mobile responsive design audit (most Iranian users will be on mobile)
Performance optimization (lazy loading, image compression, query optimization)
SEO setup for .ir domain (meta tags, Open Graph, sitemap)
Security audit (SQL injection prevention, rate limiting, input sanitization, CSRF)
Error handling (empty states, loading states, error states, offline indicators)
Email notification system (welcome, season reminders, ranking changes)
Onboarding flow for new users (guided tour, explain features, prompt verification)

Blackout Resilience Test
Disconnect the production server from international internet (block all non-.ir traffic)
Test EVERY feature in NIN-only mode: login, upload, chat, stories, AI, leaderboard, payments
Verify AI failover: OpenRouter fails → Ollama responds → user experience is seamless
Verify payment gateway works in NIN-only mode
Run a simulated 24-hour blackout test with the beta group

Staged Launch
Week 16-17: Internal testing — you use every feature, find and fix bugs
Week 17-18: Alpha — 10-15 trusted traders test on dev server
Week 18-19: Founding clans — help alpha testers form 5-10 clans on prod server
Week 19-20: Beta — expand to 100-200 users on prod, monitor performance at scale
Week 20: Public soft launch — announce to Telegram first, then Instagram and YouTube




User Testing Strategy
Testing with real users happens at multiple checkpoints. All testing before public launch happens on the DEV server.




Timeline Overview





The Blackout Advantage
This section explains why the Iranian-first architecture is not just a defensive measure — it is your single biggest competitive advantage.

What Happens During a Shutdown


When the internet goes down and millions of Iranian users lose access to every social platform they use daily, ClanTrader is the one place that still works. Your clans are still chatting. Your leaderboard is still updating. Your stories are still posting. Your AI assistant is still answering questions.

This is not a minor feature. This is the single most powerful user acquisition and retention tool you could possibly have. Every shutdown becomes a marketing event. Every blackout proves the platform's value. Users who experience ClanTrader during a shutdown will never leave, because they know this is the platform that never abandons them.




Risk Register




Success Metrics

Month 1 Targets
500+ registered users (spectators + verified traders)
100+ verified trader profiles
20+ active clans
Daily active users: 30%+ returning daily

Month 3 Targets
2,000+ registered users
500+ verified traders
75+ active clans
50+ pro subscribers
First clan access subscriptions generating marketplace revenue

Month 6 Targets
10,000+ registered users
2,000+ verified traders
200+ active clans
$3,000-5,000+/month in platform revenue
3+ completed seasons
Survived at least one blackout with users actively engaged



"The platform that never goes dark."

ClanTrader  —  Built for Resilience


# UPDATED DEVELOPMENT & DEPLOYMENT STRATEGY (FINAL)
This section supersedes all previous references to local Windows development or WSL-based workflows.
## 1. Development Environment (Authoritative)
- Primary development is performed on a remote Ubuntu 24 server located outside Iran.
- Claude Code CLI (Opus) is installed and used exclusively on this development server.
- Developer connects via SSH / VS Code Remote SSH.
- Development environment always has international internet access.
- Development is completely unaffected by Iranian blackouts.
## 2. Production Environment (Iran)
- Production server is hosted inside Iran and must remain operational during internet blackouts.
- The production server MUST NOT depend on GitHub, Anthropic, OpenRouter, Microsoft services, or any international API at runtime.
- The production server runs the web app, PostgreSQL, Socket.io, local file storage, and later a local Ollama fallback.
## 3. Deployment Model (Push-Only, Blackout-Safe)
- All builds are created on the development server.
- Deployment is performed by pushing artifacts to the Iranian production server via SSH/rsync.
- The Iranian server never pulls code from GitHub.
## 4. Git Strategy
- GitHub is the source of truth and backup.
- Only the development server requires GitHub access.
- Production servers do not require Git access.
- Optional future upgrade: self-hosted Gitea inside Iran.
## 5. AI Usage Separation (Critical Rule)
- Claude Code CLI is strictly development-only.
- Claude Code must never be installed on production servers.
- User-facing AI features are handled separately with blackout-safe fallbacks.
## 6. Blackout Impact Summary
- Development: Not affected
- Coding with Claude: Not affected
- GitHub access (development): Not affected
- Iranian users: Fully operational
- Clan chat and channels: Fully operational
- AI fallback (later phase): Fully operational
## 7. Timeline Impact
This decision removes all Windows/WSL-related risk and increases stability.
Revised expected timeline remains 4–5 months.
