"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const CandlestickScene = dynamic(
  () => import("@/components/landing/CandlestickScene"),
  { ssr: false }
);

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center">
      {/* 3D background */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <CandlestickScene />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 max-w-3xl">
        <div className="mb-6 inline-block rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-400">
          Live trading verification
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Trade Together.{" "}
          <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Compete.
          </span>{" "}
          Prove It.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Connect your MetaTrader account, form a clan with verified traders,
          and compete in monthly seasons. Your real trades. Your real edge.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
