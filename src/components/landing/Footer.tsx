import { CandlestickChart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-5 w-5 text-green-400" />
          <span className="text-sm text-muted-foreground">
            ClanTrader &mdash; Trade Together. Compete. Prove It.
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ClanTrader. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
