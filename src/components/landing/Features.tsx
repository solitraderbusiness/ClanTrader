import { CheckCircle, Shield, Trophy, TrendingUp } from "lucide-react";

const features = [
  {
    icon: CheckCircle,
    title: "Verify",
    description:
      "Upload your MT4/MT5 trading statement. Your stats are parsed and verified — no fake screenshots.",
  },
  {
    icon: Shield,
    title: "Join a Clan",
    description:
      "Team up with 3-6 traders. Combine your skills, share strategies, and compete as a unit.",
  },
  {
    icon: Trophy,
    title: "Compete",
    description:
      "Monthly seasons with real rankings. Return %, risk management, and consistency all count.",
  },
  {
    icon: TrendingUp,
    title: "Rise",
    description:
      "Earn badges, climb the leaderboard, and build a verified trading reputation over time.",
  },
];

export function Features() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="space-y-3 text-center">
              <div className="flex justify-center">
                <feature.icon className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
