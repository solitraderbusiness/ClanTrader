import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { StatementList } from "@/components/statements/StatementList";
import { Upload } from "lucide-react";

export default async function StatementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const statements = await db.tradingStatement.findMany({
    where: { userId: session.user.id },
    orderBy: { uploadedAt: "desc" },
  });

  const serialized = statements.map((s) => ({
    ...s,
    extractedMetrics: s.extractedMetrics as Record<string, unknown> | null,
    uploadedAt: s.uploadedAt.toISOString(),
    verifiedAt: s.verifiedAt?.toISOString() ?? null,
    expiresAt: s.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Statements</h1>
          <p className="text-muted-foreground">
            Your uploaded trading statements and their verification status.
          </p>
        </div>
        <Link href="/statements/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload New
          </Button>
        </Link>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <StatementList statements={serialized as any} />
    </div>
  );
}
