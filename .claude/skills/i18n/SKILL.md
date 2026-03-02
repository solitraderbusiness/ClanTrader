---
name: i18n
description: Add or update i18n translation keys. Use when adding user-visible text to components.
argument-hint: [feature-section]
---

Add/update i18n keys for the "$ARGUMENTS" section:

1. Read both `src/locales/en.json` and `src/locales/fa.json`
2. Check what keys already exist under the "$ARGUMENTS" section
3. Add missing keys to BOTH files simultaneously
4. Rules:
   - English: natural, concise text
   - Persian: proper Farsi translation (not transliteration), right-to-left aware
   - Keep keys sorted alphabetically within the section
   - Use nested objects for feature sections: `"events": { "title": "...", ... }`
   - Use `{{variable}}` syntax for interpolation: `"greeting": "Hello {{name}}"`
   - Keep key names in camelCase English: `"emptyDesc"`, `"loadMore"`, `"startingNow"`
5. Verify valid JSON after editing both files (no trailing commas, proper escaping)

**Existing sections for reference:** common, auth, settings, profile, clan, chat, trade, channel, discover, leaderboard, onboarding, statements, admin, dm, integrity, events
