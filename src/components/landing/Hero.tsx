import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function Hero() {
  return (
    <section className="flex flex-col items-center px-4 py-20 text-center">
      <Shield className="mb-6 h-16 w-16 text-primary" />
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        The platform that{" "}
        <span className="text-primary">never goes dark</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Verify your trading with real statements. Form clans. Compete in monthly
        seasons. Build a reputation that matters.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild size="lg">
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </section>
  );
}
