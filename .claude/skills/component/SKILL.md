---
name: component
description: Scaffold a new React component following ClanTrader conventions. Use when creating new UI components.
argument-hint: [ComponentName] [feature-folder]
---

Create component `$0` in `src/components/$1/$0.tsx`:

**Structure:**
1. Add `"use client"` ONLY if the component needs interactivity, hooks, or browser APIs
2. TypeScript with explicit prop interface: `interface $0Props { ... }`
3. Named export: `export function $0({ ... }: $0Props)`

**Styling:**
- Tailwind CSS with logical properties: `ms-`, `me-`, `ps-`, `pe-` (NOT `ml-`, `mr-`, `pl-`, `pr-`)
- Use shadcn/ui components from `@/components/ui/*` (Badge, Button, Sheet, Dialog, etc.)
- Support dark mode via Tailwind `dark:` variants

**i18n:**
- `import { useTranslation } from "@/lib/i18n"`
- `const { t } = useTranslation()`
- Add keys to BOTH `src/locales/en.json` and `src/locales/fa.json`
- Never hardcode user-visible strings

**State:**
- Zustand stores in `src/stores/*-store.ts` for shared state
- Local state with `useState` for component-only state
- Socket.io via `import { getSocket } from "@/lib/socket-client"`

**Patterns to follow:**
- Sheets/Drawers: see `src/components/chat/EventsSheet.tsx`
- Forms: React Hook Form + Zod resolver
- Loading: `<Loader2 className="h-6 w-6 animate-spin" />`
- Empty states: `<EmptyState icon={...} title={...} description={...} />`

After creating, run `npm run lint` to verify.
