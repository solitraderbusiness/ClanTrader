/**
 * Sync economic calendar events from ForexFactory JSON feed.
 * Run via: npx tsx scripts/calendar-sync.ts
 * Intended to run as a cron job every 6 hours.
 */

import { createHash } from "crypto";
import { PrismaClient, type EventImpact } from "@prisma/client";

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const SOURCE = "FOREXFACTORY";

interface FFEvent {
  title: string;
  country: string;
  date: string; // ISO date string
  impact: string; // "High" | "Medium" | "Low" | "Holiday" etc.
  forecast: string;
  previous: string;
  actual?: string;
}

function mapImpact(ffImpact: string): EventImpact {
  switch (ffImpact.toLowerCase()) {
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      return "NONE";
  }
}

// Map country names to currency codes
const countryCurrency: Record<string, string> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  AUD: "AUD",
  NZD: "NZD",
  CAD: "CAD",
  CHF: "CHF",
  CNY: "CNY",
};

function makeExternalId(title: string, date: string): string {
  return createHash("sha256")
    .update(`${title}:${date}`)
    .digest("hex")
    .slice(0, 20);
}

async function main() {
  const db = new PrismaClient();

  try {
    console.log(`[calendar-sync] Fetching from ForexFactory...`);
    const res = await fetch(FF_URL);

    if (!res.ok) {
      throw new Error(`Failed to fetch FF calendar: ${res.status}`);
    }

    const events: FFEvent[] = await res.json();
    console.log(`[calendar-sync] Received ${events.length} events`);

    let created = 0;
    let updated = 0;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const event of events) {
      const startTime = new Date(event.date);
      if (isNaN(startTime.getTime())) continue;
      if (startTime < cutoff) continue;

      const externalId = makeExternalId(event.title, event.date);
      const currency = countryCurrency[event.country] || event.country || null;

      const result = await db.tradingEvent.upsert({
        where: {
          externalId_source: {
            externalId,
            source: SOURCE,
          },
        },
        create: {
          externalId,
          title: event.title,
          country: event.country || null,
          currency,
          impact: mapImpact(event.impact),
          startTime,
          forecast: event.forecast || null,
          previous: event.previous || null,
          actual: event.actual || null,
          source: SOURCE,
          isActive: true,
        },
        update: {
          title: event.title,
          country: event.country || null,
          currency,
          impact: mapImpact(event.impact),
          startTime,
          forecast: event.forecast || null,
          previous: event.previous || null,
          actual: event.actual || null,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    console.log(
      `[calendar-sync] Done: ${created} created, ${updated} updated, ${events.length} total`,
    );
  } catch (err) {
    console.error("[calendar-sync] Error:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
