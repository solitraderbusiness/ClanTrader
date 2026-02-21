import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { type Locale, getDirection } from "@/lib/locale";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { FontApplier } from "@/components/providers/FontApplier";

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

const sahel = localFont({
  src: "../fonts/SahelVariable.woff2",
  variable: "--font-sahel",
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

// TODO: read locale from cookie/header when full i18n is implemented
const locale: Locale = "en";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={`${inter.variable} ${geist.variable} ${jakarta.variable} ${vazirmatn.variable} ${sahel.variable}`}
    >
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <FontApplier />
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
