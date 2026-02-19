import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { type Locale, getDirection } from "@/lib/locale";

const inter = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
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
    <html lang={locale} dir={getDirection(locale)} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
