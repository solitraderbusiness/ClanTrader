import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminStatementsDashboard } from "@/components/admin/AdminStatementsDashboard";

export default async function AdminStatementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/home");

  const [statements, allCount, pendingCount, verifiedCount, rejectedCount, expiredCount] =
    await Promise.all([
      db.tradingStatement.findMany({
        where: { verificationStatus: "PENDING" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
        take: 20,
      }),
      db.tradingStatement.count(),
      db.tradingStatement.count({ where: { verificationStatus: "PENDING" } }),
      db.tradingStatement.count({ where: { verificationStatus: "VERIFIED" } }),
      db.tradingStatement.count({ where: { verificationStatus: "REJECTED" } }),
      db.tradingStatement.count({ where: { verificationStatus: "EXPIRED" } }),
    ]);

  const serialized = statements.map((s) => ({
    ...s,
    extractedMetrics: s.extractedMetrics as Record<string, unknown> | null,
    uploadedAt: s.uploadedAt.toISOString(),
    verifiedAt: s.verifiedAt?.toISOString() ?? null,
    expiresAt: s.expiresAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statement Reviews</h1>
        <p className="text-muted-foreground">
          Review and verify trader statements.
        </p>
      </div>
      <AdminStatementsDashboard
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialStatements={serialized as any}
        initialCounts={{
          all: allCount,
          pending: pendingCount,
          verified: verifiedCount,
          rejected: rejectedCount,
          expired: expiredCount,
        }}
      />
    </div>
  );
}
