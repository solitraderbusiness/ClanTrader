# ClanTrader

Competitive social trading platform — clans, seasons, leaderboards, real-time chat, MetaTrader EA bridge with integrity verification.

## Stack

Next.js 16.1 / React 19 / Prisma 7 / PostgreSQL 16 / Socket.io 4.8 / Redis / TypeScript strict

## Quick Start

```bash
cp .env.example .env          # configure database, redis, auth
docker compose up -d           # start postgres + redis + glitchtip
npm install
npm run db:push
npm run dev
```

## Docs

- **[CLAUDE.md](CLAUDE.md)** — Development rules, product architecture, project guidance
- **[docs/README.md](docs/README.md)** — Full documentation index
