"use client";

import { RecomputePanel } from "@/components/admin/RecomputePanel";
import { DryRunPreview } from "@/components/admin/DryRunPreview";
import Link from "next/link";

export default function BadgeRecomputePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badge Recompute & Dry-run</h1>
        <p className="text-sm text-muted-foreground">
          Re-evaluate badge awards or preview impact of changes.{" "}
          <Link
            href="/admin/badges"
            className="text-primary hover:underline"
          >
            Back to Badges
          </Link>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recompute</h2>
        <RecomputePanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dry Run</h2>
        <DryRunPreview />
      </section>
    </div>
  );
}
