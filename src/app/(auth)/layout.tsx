import { CandlestickChart } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark bg-background text-foreground">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <CandlestickChart className="h-8 w-8 text-green-400" />
          <span className="text-2xl font-bold">ClanTrader</span>
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
