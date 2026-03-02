import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectTaskSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

const SEED_TASKS = [
  // ── Phase 1 — Auth & Profiles ─────────────────────────────────
  { title: "Phone OTP auth (Kavenegar)", phase: "P1", column: "DONE" as const, priority: "HIGH" as const, position: 10, description: "Phone-first auth via SMS OTP. Kavenegar integrated, console fallback in dev." },
  { title: "Email + password auth", phase: "P1", column: "DONE" as const, priority: "HIGH" as const, position: 20, description: "Credentials provider with bcrypt hashing, login/signup flows." },
  { title: "Email verification flow", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 30, description: "Nodemailer sends verification email with 24h token. Needs SMTP config for prod." },
  { title: "Password reset flow", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 40, description: "Forgot password + reset with 1h expiring token. Needs SMTP for prod." },
  { title: "User profiles & avatars", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 50 },
  { title: "Username system + availability check", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 60, description: "Real-time debounced (500ms) availability check with validation." },
  { title: "JWT sessions (Auth.js v5)", phase: "P1", column: "DONE" as const, priority: "HIGH" as const, position: 70 },
  { title: "i18n + RTL support (en/fa)", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 80 },
  { title: "EA/MT auth (register + login)", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 90, description: "Username+password auth for MetaTrader EA with API key generation." },
  { title: "Phone add/change flow", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 100, description: "Multi-mode OTP: login, add-phone, signup. Redis-backed with rate limiting." },
  { title: "Referral tracking on signup", phase: "P1", column: "DONE" as const, priority: "NORMAL" as const, position: 110, description: "Fire-and-forget event tracking for LINK_CLICKED, SIGNUP, etc." },

  // ── Phase 2 — Statements & Verification ────────────────────────
  { title: "Statement upload flow", phase: "P2", column: "DONE" as const, priority: "HIGH" as const, position: 10 },
  { title: "HTML statement parsing", phase: "P2", column: "DONE" as const, priority: "HIGH" as const, position: 20, description: "Cheerio-based parser extracting metrics from MT4/MT5 HTML reports." },
  { title: "Admin statement review", phase: "P2", column: "DONE" as const, priority: "NORMAL" as const, position: 30, description: "View original HTML, approve/reject with notes." },
  { title: "MT account linking", phase: "P2", column: "DONE" as const, priority: "NORMAL" as const, position: 40 },
  { title: "Auto-recalculate on close", phase: "P2", column: "DONE" as const, priority: "NORMAL" as const, position: 50 },
  { title: "TraderStatement aggregation", phase: "P2", column: "DONE" as const, priority: "NORMAL" as const, position: 60, description: "Monthly, seasonal, all-time metrics per user/clan." },

  // ── Phase 3 — Clans & Chat ─────────────────────────────────────
  { title: "Clan CRUD + settings", phase: "P3", column: "DONE" as const, priority: "HIGH" as const, position: 10 },
  { title: "Real-time chat (Socket.io)", phase: "P3", column: "DONE" as const, priority: "HIGH" as const, position: 20 },
  { title: "Chat topics & threading", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 30 },
  { title: "Signal & analysis trade cards", phase: "P3", column: "DONE" as const, priority: "HIGH" as const, position: 40 },
  { title: "Trade tracking & lifecycle", phase: "P3", column: "DONE" as const, priority: "HIGH" as const, position: 50, description: "PENDING→OPEN→TP_HIT/SL_HIT/BE/CLOSED with full status history." },
  { title: "Trade actions (SL/TP/BE/close)", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 60 },
  { title: "Direct messages", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 70, description: "1:1 DMs with typing indicators, read receipts, image attachments." },
  { title: "Join requests + invites", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 80 },
  { title: "Reactions & pinning", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 90 },
  { title: "Typing indicators & presence", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 100 },
  { title: "Image uploads in chat", phase: "P3", column: "DONE" as const, priority: "NORMAL" as const, position: 110, description: "Up to 4 images per message, Sharp processing to WebP + thumbnails." },
  { title: "Watchlist per clan", phase: "P3", column: "DONE" as const, priority: "LOW" as const, position: 120 },
  { title: "Slash commands (/trades, /events…)", phase: "P3", column: "DONE" as const, priority: "LOW" as const, position: 130 },
  { title: "Subscriber-only chat", phase: "P3", column: "BACKLOG" as const, priority: "LOW" as const, position: 10, description: "Live chat for followers alongside channel (pro-only). Not started." },

  // ── Phase 4 — Leaderboards & Badges ────────────────────────────
  { title: "Season management", phase: "P4", column: "DONE" as const, priority: "HIGH" as const, position: 10 },
  { title: "Multi-lens rankings (6 lenses)", phase: "P4", column: "DONE" as const, priority: "HIGH" as const, position: 20, description: "Composite, Profit, Consistency, Risk-Adjusted, Low-Risk, Activity." },
  { title: "Ranking config panel", phase: "P4", column: "DONE" as const, priority: "NORMAL" as const, position: 30 },
  { title: "Badge system (rank/perf/trophy)", phase: "P4", column: "DONE" as const, priority: "NORMAL" as const, position: 40 },
  { title: "Auto badge evaluation", phase: "P4", column: "DONE" as const, priority: "NORMAL" as const, position: 50 },
  { title: "Badge admin (CRUD, reorder, dry-run)", phase: "P4", column: "DONE" as const, priority: "NORMAL" as const, position: 60 },
  { title: "Season results page", phase: "P4", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 10, description: "Final standings, awards, highlights after season ends." },
  { title: "Live ranking movement indicators", phase: "P4", column: "BACKLOG" as const, priority: "LOW" as const, position: 20 },
  { title: "Ranking change notifications", phase: "P4", column: "BACKLOG" as const, priority: "LOW" as const, position: 30 },

  // ── Phase 5 — Content & Integrity ──────────────────────────────
  { title: "Channel feed & posts", phase: "P5", column: "DONE" as const, priority: "HIGH" as const, position: 10 },
  { title: "Auto-post from trade cards", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 20 },
  { title: "Discover page + filters", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 30, description: "Clans tab + Free Agents tab with search, focus, and tier filters." },
  { title: "Clan activity digest", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 40, description: "Per-member trade breakdowns by period." },
  { title: "Integrity contract (12 loopholes fixed)", phase: "P5", column: "DONE" as const, priority: "CRITICAL" as const, position: 50, description: "Deny-by-default eligibility, analysis upgrade protection, retroactive signal block, TP drag tracking." },
  { title: "EA/MetaTrader bridge (two-way)", phase: "P5", column: "DONE" as const, priority: "HIGH" as const, position: 60, description: "EA→Server: heartbeat, trade-event, calendar. Server→EA: pending actions." },
  { title: "Feature flags system", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 70 },
  { title: "Paywall rules infrastructure", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 80 },
  { title: "Referral analytics admin", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 90 },
  { title: "Economic calendar sync (EA)", phase: "P5", column: "DONE" as const, priority: "NORMAL" as const, position: 100, description: "MT5 EA sends calendar events, upsert with rate limiting, Socket.io reminders." },
  { title: "Stories system", phase: "P5", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 10, description: "DB model exists (Story). No API routes or UI built yet." },
  { title: "Content library (tutorials/guides)", phase: "P5", column: "BACKLOG" as const, priority: "LOW" as const, position: 20 },
  { title: "Daily peek system (3 free peeks)", phase: "P5", column: "BACKLOG" as const, priority: "LOW" as const, position: 30 },

  // ── Phase 6 — AI ───────────────────────────────────────────────
  { title: "AIRouter service (failover chain)", phase: "P6", column: "BACKLOG" as const, priority: "HIGH" as const, position: 10, description: "OpenRouter→Ollama→Cache. 3s timeout, health checks, admin force-local toggle." },
  { title: "Local Ollama setup", phase: "P6", column: "BACKLOG" as const, priority: "HIGH" as const, position: 20, description: "Mistral 7B, Llama 3 8B, Qwen 2.5 7B on Iranian AI server." },
  { title: "Spectator AI chatbot", phase: "P6", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 30, description: "3 free questions/day for non-pro users." },
  { title: "Clan AI assistant (@ai mention)", phase: "P6", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 40 },
  { title: "AI-powered trade analysis", phase: "P6", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 50 },
  { title: "Weekly auto-summary generation", phase: "P6", column: "BACKLOG" as const, priority: "LOW" as const, position: 60 },
  { title: "Response caching (Redis)", phase: "P6", column: "BACKLOG" as const, priority: "LOW" as const, position: 70 },

  // ── Phase 7 — Payments ─────────────────────────────────────────
  { title: "ZarinPal payment gateway", phase: "P7", column: "BACKLOG" as const, priority: "HIGH" as const, position: 10, description: "Primary Iranian payment gateway. Node.js SDK." },
  { title: "Subscription checkout flow", phase: "P7", column: "BACKLOG" as const, priority: "HIGH" as const, position: 20, description: "Monthly/annual Pro plans priced in Toman." },
  { title: "Paywall enforcement (payment)", phase: "P7", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 30, description: "Rules infrastructure done. Needs actual payment verification." },
  { title: "Channel subscription marketplace", phase: "P7", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 40, description: "Clans set price, 70-80% split. Browse, preview, subscribe." },
  { title: "Revenue dashboard for clans", phase: "P7", column: "BACKLOG" as const, priority: "LOW" as const, position: 50 },
  { title: "Billing management page", phase: "P7", column: "BACKLOG" as const, priority: "LOW" as const, position: 60 },

  // ── Phase 8 — Polish & Launch ──────────────────────────────────
  { title: "PWA + service worker", phase: "P8", column: "DONE" as const, priority: "HIGH" as const, position: 10, description: "Full manifest, cache strategies, offline page, LRU eviction." },
  { title: "E2E test suite (Playwright)", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 20, description: "Smoke, full, simulator suites. Admin test runner dashboard." },
  { title: "Dark mode + theme toggle", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 30 },
  { title: "Self-hosted fonts + switching", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 40, description: "3 EN + 5 FA fonts, all woff2. Per-user preference persisted." },
  { title: "Display zoom (5 levels)", phase: "P8", column: "DONE" as const, priority: "LOW" as const, position: 50 },
  { title: "Landing page", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 60 },
  { title: "Gzip compression", phase: "P8", column: "DONE" as const, priority: "LOW" as const, position: 70 },
  { title: "Admin panel (dashboard, audit, impersonate)", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 80 },
  { title: "PM2 process management", phase: "P8", column: "DONE" as const, priority: "HIGH" as const, position: 90, description: "ecosystem.config.cjs with auto-restart, memory limit, log files." },
  { title: "Staging environment + deploy scripts", phase: "P8", column: "DONE" as const, priority: "NORMAL" as const, position: 100, description: "Staging on port 3001 (Redis DB 1). deploy-pack→scp→deploy-staging→promote-to-prod." },
  { title: "Mobile responsive polish", phase: "P8", column: "IN_PROGRESS" as const, priority: "HIGH" as const, position: 10, description: "Telegram-like layout on mobile. Bottom nav, hamburger menu, overflow fixes." },
  { title: "Onboarding (intent + missions)", phase: "P8", column: "IN_PROGRESS" as const, priority: "NORMAL" as const, position: 20, description: "Intent modal (4 options) + 5-mission checklist. No guided tour yet." },
  { title: "SMTP config for production", phase: "P8", column: "TODO" as const, priority: "HIGH" as const, position: 10, description: "Code done. Need SMTP_HOST/PORT/USER/PASS for email verification & password reset." },
  { title: "Kavenegar API key for production", phase: "P8", column: "TODO" as const, priority: "HIGH" as const, position: 20, description: "Code done. Need KAVENEGAR_API_KEY for live SMS OTP." },
  { title: "Performance optimization", phase: "P8", column: "TODO" as const, priority: "NORMAL" as const, position: 30, description: "Lazy loading, image compression, query optimization." },
  { title: "Security audit (OWASP)", phase: "P8", column: "TODO" as const, priority: "HIGH" as const, position: 40 },
  { title: "Deployment checklist & docs", phase: "P8", column: "TODO" as const, priority: "NORMAL" as const, position: 50 },
  { title: "SEO (OG tags, sitemap, canonical)", phase: "P8", column: "BACKLOG" as const, priority: "LOW" as const, position: 10, description: "Basic metadata exists. Missing OG images, sitemap.ts, robots.ts." },
  { title: "Error monitoring (GlitchTip)", phase: "P8", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 20, description: "Self-hosted Sentry alternative. No dependency on international APIs." },
  { title: "CI/CD pipeline (GitHub Actions)", phase: "P8", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 30, description: "lint + type-check + build on push. No workflows exist yet." },
  { title: "Structured logging (Pino)", phase: "P8", column: "BACKLOG" as const, priority: "LOW" as const, position: 40, description: "Replace 150+ console.log calls with JSON structured logging." },
  { title: "Uptime monitoring + Telegram alerts", phase: "P8", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 50, description: "Cron health check script with Telegram bot notifications." },
  { title: "Arabic language support", phase: "P8", column: "BACKLOG" as const, priority: "LOW" as const, position: 60, description: "RTL infrastructure ready. Need ar.json translation file." },
  { title: "Blackout resilience test", phase: "P8", column: "BACKLOG" as const, priority: "NORMAL" as const, position: 70, description: "Block international traffic, verify all features work on NIN-only." },
];

async function seedIfEmpty() {
  const count = await db.projectTask.count();
  if (count > 0) return;

  await db.projectTask.createMany({ data: SEED_TASKS });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await seedIfEmpty();

    const tasks = await db.projectTask.findMany({
      orderBy: [{ column: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Get kanban tasks error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createProjectTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetColumn = parsed.data.column || "BACKLOG";

    // Auto-position at end of column
    const lastTask = await db.projectTask.findFirst({
      where: { column: targetColumn },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const task = await db.projectTask.create({
      data: {
        ...parsed.data,
        column: targetColumn,
        position: (lastTask?.position ?? 0) + 10,
      },
    });

    audit("kanban.create", "ProjectTask", task.id, session.user.id, {
      title: task.title,
      phase: task.phase,
    }, { category: "ADMIN" });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Create kanban task error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
