---
name: migrate
description: Modify Prisma schema and handle migration safely
disable-model-invocation: true
argument-hint: [model-name] [description-of-changes]
---

Modify Prisma schema for model `$0`: $1

**Steps:**

1. Read `prisma/schema.prisma` and find the `$0` model
2. Make the requested changes following conventions:
   - Use enums for fields with fixed values
   - Add `@@index` for fields used in WHERE clauses
   - Add `@@unique` for natural keys
   - Optional fields use `?` suffix
   - Always include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` on new models
3. Run `npx prisma db push --accept-data-loss` (dev environment only)
4. Run `npx prisma generate`
5. Update affected services in `src/services/` to use new fields
6. Update affected Zod schemas in `src/lib/validators.ts`
7. Run `npm run lint && npm run build` to verify nothing broke

**Important:**
- This is for the DEV environment only. Production uses proper migrations via `npx prisma migrate dev --name descriptive_name`
- If adding a required field to an existing model with data, make it optional or provide a default
- If converting a String field to an Enum, use `--accept-data-loss` flag

**Report:** What changed in schema, which services/validators were updated
