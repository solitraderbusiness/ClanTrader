import { Download, Link2, Users, Trophy } from "lucide-react";

const steps = [
  {
    icon: Download,
    title: "Install EA",
    description:
      "Download the ClanTrader Expert Advisor for MT4 or MT5. One-click install.",
  },
  {
    icon: Link2,
    title: "Connect Account",
    description:
      "The EA links your MetaTrader account to ClanTrader. Your trades are verified automatically.",
  },
  {
    icon: Users,
    title: "Join a Clan",
    description:
      "Team up with 3-6 verified traders. Share strategies, compete as a unit.",
  },
  {
    icon: Trophy,
    title: "Compete & Rise",
    description:
      "Monthly seasons with real rankings. Return, risk management, and consistency all count.",
  },
];

export function Features() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold">How It Works</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          From MetaTrader to the leaderboard in four steps
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="glass-card relative rounded-xl p-6 text-center"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-sm font-bold text-green-400">
                {i + 1}
              </div>
              <div className="mb-3 flex justify-center">
                <step.icon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
