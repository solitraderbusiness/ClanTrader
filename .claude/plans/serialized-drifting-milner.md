# Plan: Mobile-Friendly PWA with Horizontal Scroll Fix

## Context
The site is accessed from Iran where bandwidth is throttled. On mobile, users experience horizontal scrolling — they have to scroll left to see full content. The app also has zero PWA infrastructure, so it can't be installed as a native-like app on phones. This plan fixes both issues.

## Part 1: Fix Horizontal Scroll

### 1a. Add viewport export to root layout
**File: `src/app/layout.tsx`**
- Add `Viewport` import from `next`
- Export a `viewport` const with `width: "device-width"`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`
- Include `themeColor` for light (`#ffffff`) and dark (`#262626`) to style browser chrome
- Add `overflow-x-hidden` to the `<body>` className

### 1b. Add overflow-x safety net in global CSS
**File: `src/app/globals.css`**
- In `@layer base`, add `overflow-x: hidden` on both `html` and `body`
- This is a belt-and-suspenders fix: prevents any content from causing horizontal scroll

## Part 2: PWA Implementation

### 2a. Generate placeholder app icons
- Create `scripts/generate-icons.ts` using `sharp` (already a dependency) to produce 4 PNGs:
  - `public/icons/icon-192.png` (192x192)
  - `public/icons/icon-512.png` (512x512)
  - `public/icons/icon-maskable-192.png` (192x192, safe zone padding)
  - `public/icons/icon-maskable-512.png` (512x512, safe zone padding)
- Run once, commit the PNGs, delete the script after

### 2b. Create web app manifest
**New file: `public/manifest.json`**
- `name: "ClanTrader"`, `short_name: "ClanTrader"`
- `start_url: "/home"`, `display: "standalone"`, `orientation: "portrait-primary"`
- References the 4 icon files (regular + maskable at 192 and 512)
- No external URLs — fully Iranian-first compliant

### 2c. Create service worker
**New file: `public/sw.js`** (plain JS, served directly by browser)
- **Navigation**: network-first with offline fallback
- **Static assets** (JS/CSS/images/fonts): stale-while-revalidate (great for throttled connections)
- **API/Socket.io requests**: skipped (never cached)
- Uses `skipWaiting()` + `clients.claim()` for immediate activation

### 2d. Create offline fallback page
**New file: `src/app/offline/page.tsx`**
- Simple server component: "You are offline" message
- Styled consistently with the app

### 2e. Create ServiceWorkerProvider
**New file: `src/components/providers/ServiceWorkerProvider.tsx`**
- Client component that registers `/sw.js` on mount
- Renders nothing (returns null)

### 2f. Update root layout with PWA metadata
**File: `src/app/layout.tsx`**
- Add to `metadata`: `manifest: "/manifest.json"`, `appleWebApp` config, `icons`
- Import and render `<ServiceWorkerProvider />` alongside `<Toaster />`

## File Summary

| File | Action |
|------|--------|
| `src/app/layout.tsx` | Modify — viewport export, PWA metadata, overflow-x-hidden, ServiceWorkerProvider |
| `src/app/globals.css` | Modify — overflow-x: hidden on html/body |
| `public/manifest.json` | Create — web app manifest |
| `public/sw.js` | Create — service worker |
| `public/icons/*.png` | Create — 4 app icons (generated via script) |
| `src/app/offline/page.tsx` | Create — offline fallback |
| `src/components/providers/ServiceWorkerProvider.tsx` | Create — SW registration |
| `scripts/generate-icons.ts` | Create then delete — one-time icon generation |

## Verification
1. `npm run lint && npm run build` — must pass
2. Open Chrome DevTools → Application → Manifest — should show all fields
3. Application → Service Workers — should show registered sw.js
4. On mobile: no horizontal scroll, "Add to Home Screen" prompt available
5. Lighthouse PWA audit should pass core checks
