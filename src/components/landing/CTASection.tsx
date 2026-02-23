import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-10 text-center">
        <h2 className="text-3xl font-bold">Ready to prove your edge?</h2>
        <p className="mt-3 text-muted-foreground">
          Connect your MetaTrader account, join a clan, and start competing today.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/signup">Get Started Free</Link>
        </Button>
      </div>
    </section>
  );
}
