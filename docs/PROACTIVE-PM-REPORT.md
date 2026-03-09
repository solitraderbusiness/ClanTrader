# Proactive PM: AI-Powered Project Digest System

> A productivity tool that turns your project board into an actionable daily pulse — not another report to read, but a system that drives daily focus, surfaces risks early, and builds accountability through streaks.

---

## 1. Executive Summary

**Problem:** Traditional project boards are passive — they show you everything but tell you nothing. You open a Kanban board with 200 tasks and still don't know what to work on today, what's at risk, or whether you're on track for launch.

**Solution:** Proactive PM delivers two concise daily digests (morning + evening) that:
- **Prioritize** your day by scoring every task and surfacing the top 3
- **Detect risks** automatically — stuck tasks, untouched criticals, testing pile-ups
- **Track momentum** with productivity streaks and velocity metrics
- **Project launch readiness** with countdown, buffer analysis, and blocker tracking

**Delivery:** Dual-channel — Telegram for mobile push notifications + in-app admin panel for web access and historical analytics.

**Built for:** Solo founders, small teams, and indie builders who need a PM copilot without the overhead of a PM tool.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────┐
│                 PROJECT BOARD                     │
│    (Kanban: BACKLOG → TODO → IN_PROGRESS →       │
│              TESTING → DONE)                      │
└──────────────────┬──────────────────────────────┘
                   │
          ┌────────┴────────┐
          │  Digest Engine  │
          │  (Pure Functions)│
          └───┬─────────┬───┘
              │         │
     ┌────────┴──┐ ┌────┴────────┐
     │  Morning  │ │   Evening   │
     │  8 AM     │ │   10 PM     │
     └─────┬─────┘ └──────┬──────┘
           │               │
    ┌──────┴──────┐  ┌─────┴──────┐
    │  Telegram   │  │   Redis    │
    │  (push)     │  │  (streak)  │
    └─────────────┘  └────────────┘
```

### Two Digests, One System

| | Morning (8 AM) | Evening (10 PM) |
|---|---|---|
| **Purpose** | Focus & risk awareness | Accountability & momentum |
| **Tone** | "Here's what matters today" | "Here's what you shipped" |
| **Length** | ~12-15 lines | ~10-12 lines |
| **Key sections** | Standup, Focus, Countdown, Nudges | Results, Streak, Tomorrow |

---

## 3. Morning Digest

### Sample Output

```
☀️ Saturday, Mar 8

Bug fix day — 3 fixes, 1 infra task

📋 Today's Focus
  1. Fix login rate limiting (overdue · CRITICAL)
  2. Trade card preview (due today)
  3. Socket auth refactor (in progress)

🚀 Alpha in 23 days · 12 blockers left
   ✅ On track (+5 day buffer)

⏰ WebSocket reconnect stuck 5 days
🔴 CSRF protection is CRITICAL but not started

W4 Alpha Launch ██████░░░░ 62%
Overall ████████░░ 78% (160/205)
⚡ 12 this week

→ Open Board
```

### Section Breakdown

#### 1. Standup Narrative
Automatically groups yesterday's completed tasks by category and generates a one-line summary.

**How it works:**
- Queries all tasks with `completedAt` in yesterday's date range
- Groups by category (BUG, FEATURE, INFRA, SECURITY, etc.)
- Determines "day type" from the dominant category
- Generates natural language: *"Bug fix day — 3 fixes, 1 feature"*

**Why it matters:** Instead of reading a list of completions, you get instant context about what kind of work dominated yesterday — helping you balance your workload.

#### 2. Top 3 Focus (Smart Scoring)
Every non-done task is scored using a weighted algorithm, and the top 3 are surfaced.

**Scoring weights:**

| Factor | Points | Rationale |
|---|---|---|
| Overdue | +100 | Past-due tasks must be addressed first |
| CRITICAL priority | +80 | User-defined urgency |
| Launch blocker | +60 | Directly impacts ship date |
| Due today | +50 | Time-sensitive |
| HIGH priority | +40 | Important but not critical |
| IN_PROGRESS | +25 | Already started = momentum |

**Example scoring:**
- "Fix login rate limiting" → overdue (100) + CRITICAL (80) = **180 points**
- "Trade card preview" → due today (50) = **50 points**
- "Socket auth refactor" → IN_PROGRESS (25) + HIGH (40) = **65 points**

Tasks in BACKLOG and DONE are excluded. Each task shows contextual tags: *(overdue · CRITICAL)*, *(due today)*, *(in progress)*.

#### 3. Launch Countdown
Shows days remaining to the configured launch date, with intelligent velocity projection.

**Calculation:**
1. Days left = `LAUNCH_TARGET_DATE` - today
2. Daily velocity = tasks completed in last 14 days ÷ 14
3. Projected days needed = remaining tasks ÷ daily velocity
4. Buffer = days left - projected days

**Status indicators:**
- ✅ **On track** — buffer ≥ 5 days
- ⚠️ **Tight** — buffer 0-4 days
- 🔴 **At risk** — buffer negative (projected to miss deadline)

#### 4. Smart Nudges (Max 2)
The system detects common project management anti-patterns and surfaces the top 2 most urgent alerts.

**Detection rules:**

| Nudge Type | Trigger | Urgency Score |
|---|---|---|
| Stuck task | IN_PROGRESS for 4+ days | 70 + days_stuck |
| Critical untouched | CRITICAL priority, not in progress | 90 |
| Testing pile-up | 3+ tasks in TESTING column | 60 |
| Due today, not started | Due today but still in TODO/BACKLOG | 75 |

Nudges are scored by urgency and only the top 2 are shown — keeping the digest concise while ensuring the most important alerts surface.

#### 5. Progress Bars
Visual progress for current phase and overall project:
```
W4 Alpha Launch ██████░░░░ 62%
Overall ████████░░ 78% (160/205)
⚡ 12 this week
```
The current phase is auto-detected as the first phase (W1-W8) with incomplete tasks.

---

## 4. Evening Digest

### Sample Output

```
🌙 End of Day — Mar 8

✅ 4 tasks shipped
  • Fix login rate limiting
  • Trade card preview
  • Mobile nav RTL fix
  • Audit log cleanup

📦 2 carried over to tomorrow

🔥 6 day streak! (best: 12)
   ▁██▁███ avg 2.7/day

Tomorrow: Socket auth, DM receipts, Badge tests

→ Open Board
```

### Section Breakdown

#### 1. Day Results
Lists tasks completed today (up to 5, with "+N more" overflow). Gives a concrete sense of daily output.

#### 2. Carried Over
Count of tasks still IN_PROGRESS at end of day. Not punitive — just awareness. Consistently high carry-over signals scope issues or context-switching.

#### 3. Productivity Streak
Tracks consecutive days with at least one completed task.

**Visual elements:**
- Current streak count + personal best
- 7-day sparkline: `▁██▁███` — shows daily output pattern at a glance
- Daily average across the sparkline window

**Streak mechanics:**
- Complete ≥1 task today, and yesterday was a streak day → streak increments
- Gap in dates → streak resets to 1
- Zero completions → streak breaks (but only counted next day)

#### 4. Tomorrow Preview
Reuses the same scoring algorithm from the morning digest to preview the top 3 tasks for tomorrow. Helps you mentally prepare or adjust the board before bed.

---

## 5. Streak & Accountability Engine

### How Streaks Work

```json
{
  "current": 6,
  "longest": 12,
  "lastDate": "2026-03-08",
  "history": [3, 2, 0, 5, 1, 4, 2]
}
```

**Storage:** Redis key `digest:streak` — lightweight, fast, no schema migration needed.

**Update rules:**
1. Evening digest counts today's completions
2. If `lastDate` was yesterday and completions > 0 → `current++`
3. If there's a date gap → `current = 1`
4. `longest` tracks the all-time best
5. `history` is a rolling 7-day window for the sparkline

**Sparkline visualization:** Maps daily counts to Unicode block characters:
```
▁▂▃▄▅▆▇█
```
Each character represents relative output — the tallest bar is the day with the most completions.

**Graceful degradation:** If Redis is unavailable, the streak section is simply omitted. The digest still sends everything else.

---

## 6. Technical Architecture

### Design Principles

1. **Pure functions** — Digest builders take data in, return strings out. No database imports in the core library. This makes them testable, portable, and composable.

2. **Thin wrappers** — Scripts and API routes are just plumbing: fetch tasks → call builder → send result. All logic lives in the shared library.

3. **Dual delivery** — Same message goes to Telegram (push) and will be persisted to database (in-app history + future analytics).

### File Structure

```
src/lib/digest/
├── types.ts          # Task, DigestContext, StreakData interfaces
├── helpers.ts        # Scoring, narrative, nudges, progress bars
├── morning.ts        # buildMorningDigest(tasks, now) → HTML string
├── evening.ts        # buildEveningDigest(tasks, now, streak) → HTML string
└── streak-store.ts   # Redis load/save/update for streak data

scripts/
├── daily-digest.ts   # Cron wrapper: DB → builder → Telegram
└── evening-digest.ts # Cron wrapper: DB → builder → streak → Telegram

src/app/api/admin/
├── daily-digest/route.ts    # Manual trigger (admin-only)
└── evening-digest/route.ts  # Manual trigger (admin-only)
```

### Scheduling

| Digest | Cron (UTC) | Local Time (Iran) |
|---|---|---|
| Morning | `30 4 * * *` | 8:00 AM IRST |
| Evening | `30 18 * * *` | 10:00 PM IRST |

### Test Coverage

44 unit tests covering:
- Scoring algorithm (overdue, critical, blocker, combined)
- Task prioritization (filtering, sorting, top-N)
- Standup narrative generation (category grouping, day typing)
- Focus labels (tag composition)
- Launch countdown (days, blockers, velocity, buffer)
- Nudge detection (stuck, critical, pile-up, limits)
- Streak mechanics (consecutive, gap, reset, same-day, history cap)
- Full digest integration (morning + evening with various data states)
- Edge cases (zero tasks, no launch date, empty yesterday)

---

## 7. Future: In-App Notifications & Analytics

### Phase 2: In-App (Planned)

Every sent digest will be persisted to a `DigestRecord` database table with structured metadata:
```
DigestRecord {
  type:      MORNING | EVENING
  content:   HTML message
  metadata:  { completedCount, overdueCount, blockerCount, velocity7d, streak }
  createdAt: timestamp
}
```

**Admin digest page** (`/admin/digests`):
- Latest digest highlighted as an in-app notification card
- Scrollable history of all past digests
- Filter by type (Morning / Evening)

### Phase 3: Project Analytics (Future)

The metadata we're collecting now enables powerful retrospective analytics:

| Metric | Source | Insight |
|---|---|---|
| **Velocity trend** | `velocity7d` over time | Is the team accelerating or decelerating? |
| **Category distribution** | Completed task categories | Too much bug fixing? Not enough features? |
| **Blocker resolution time** | Blocker count trend | How quickly are blockers being resolved? |
| **Streak correlation** | Streak vs. velocity | Does consistency correlate with higher output? |
| **Phase predictions** | Phase progress + velocity | When will each phase realistically complete? |
| **Nudge effectiveness** | Nudge frequency → resolution | Do nudged tasks get resolved faster? |
| **Carry-over patterns** | Evening carry-over counts | Which days/phases have the most unfinished work? |
| **Launch readiness** | Buffer trend over time | Is the buffer growing or shrinking? |

This data builds a complete picture of project execution efficiency — not just "what was done" but "how was it done" and "what patterns lead to better outcomes."

---

## 8. Why This Approach

### What makes it different from standard PM tools

| Traditional PM Tools | Proactive PM |
|---|---|
| Dashboard you visit | Digest that comes to you |
| Shows everything equally | Scores and surfaces what matters |
| You decide what to work on | Suggests the top 3 based on urgency |
| Retrospectives are manual | Automatic daily accountability |
| No momentum tracking | Streaks gamify consistency |
| Risk detection is manual | Automatic nudges for stuck/overdue/pile-up |
| Velocity is a chart you check | Velocity is in your morning brief |

### Design decisions

1. **15 lines max** — If the digest is too long, you stop reading it. Brevity is a feature.
2. **Max 2 nudges** — Alert fatigue is real. Only the most urgent issues surface.
3. **Scored prioritization** — Removes decision fatigue at the start of the day.
4. **Streaks, not guilt** — Positive reinforcement (streak building) over negative (overdue shaming).
5. **Pure functions** — The entire digest engine can be tested without a database, used from any context, and extended without coupling.

---

## 9. Getting Started

### Prerequisites
- Kanban board with tasks (phases W1-W8, columns: BACKLOG → DONE)
- Telegram bot token + chat ID for push delivery
- Redis for streak persistence
- Optional: `LAUNCH_TARGET_DATE` env var for countdown

### Quick Test
```bash
# Send morning digest now
npx tsx scripts/daily-digest.ts

# Send evening digest now (also updates streak)
npx tsx scripts/evening-digest.ts

# Check streak in Redis
redis-cli GET digest:streak
```

### Configuration
```env
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-chat-id"
LAUNCH_TARGET_DATE="2026-04-01"  # Optional
```

---

*Built as part of ClanTrader — a competitive social trading platform. The Proactive PM system manages the development of a 200+ task project across 8 development phases.*
