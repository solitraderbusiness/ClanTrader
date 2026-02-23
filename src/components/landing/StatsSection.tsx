const stats = [
  { value: "2,400+", label: "Active Traders" },
  { value: "180K+", label: "Verified Trades" },
  { value: "320+", label: "Active Clans" },
  { value: "12", label: "Monthly Seasons" },
];

export function StatsSection() {
  return (
    <section className="border-y border-white/10 py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl font-bold text-green-400">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
