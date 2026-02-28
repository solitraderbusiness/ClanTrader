import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { type Locale, getDirection } from "@/lib/locale";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { FontApplier } from "@/components/providers/FontApplier";
import { ZoomApplier } from "@/components/providers/ZoomApplier";
import { LocaleApplier } from "@/components/providers/LocaleApplier";
import { cookies } from "next/headers";

const inter = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const geist = localFont({
  src: "../fonts/GeistVariable.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});

const jakarta = localFont({
  src: "../fonts/PlusJakartaSansVariable.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "200 800",
});

const vazirmatn = localFont({
  src: "../fonts/VazirmatnVariable.woff2",
  variable: "--font-vazirmatn",
  display: "swap",
  weight: "100 900",
});

const yekanbakh = localFont({
  src: [
    { path: "../fonts/YekanBakh.woff2", weight: "400", style: "normal" },
    { path: "../fonts/YekanBakh-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-yekanbakh",
  display: "swap",
});

const shabnam = localFont({
  src: [
    { path: "../fonts/Shabnam-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/Shabnam.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Shabnam-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Shabnam-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-shabnam",
  display: "swap",
});

const estedad = localFont({
  src: "../fonts/Estedad-Variable.woff2",
  variable: "--font-estedad",
  display: "swap",
  weight: "100 900",
});

const samim = localFont({
  src: [
    { path: "../fonts/Samim.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Samim-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Samim-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-samim",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ClanTrader",
    template: "%s | ClanTrader",
  },
  description:
    "Competitive social trading platform. Verify your trading, form clans, compete in seasons.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClanTrader",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale: Locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "fa";
  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={`${inter.variable} ${geist.variable} ${jakarta.variable} ${vazirmatn.variable} ${yekanbakh.variable} ${shabnam.variable} ${estedad.variable} ${samim.variable}`}
    >
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <LocaleApplier />
        <FontApplier />
        <ZoomApplier />
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
