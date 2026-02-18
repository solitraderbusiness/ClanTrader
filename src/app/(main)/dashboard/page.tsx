export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to ClanTrader. Your home for competitive trading.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Stories</h3>
          <p className="text-sm text-muted-foreground">Coming in Phase 5</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Your Clan</h3>
          <p className="text-sm text-muted-foreground">Coming in Phase 3</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">Season Rankings</h3>
          <p className="text-sm text-muted-foreground">Coming in Phase 4</p>
        </div>
      </div>
    </div>
  );
}
