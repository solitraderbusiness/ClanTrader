import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { type Locale, getDirection } from "@/lib/locale";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ClanTrader",
    template: "%s | ClanTrader",
  },
  description:
    "Competitive social trading platform. Verify your trading, form clans, compete in seasons.",
};

// TODO: read locale from cookie/header when full i18n is implemented
const locale: Locale = "en";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
