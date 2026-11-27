import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { PWA_EARLY_SCRIPT } from "@/lib/pwa-script";
import { PwaProvider } from "@/components/pwa/pwa-provider";

export const metadata: Metadata = {
  title: {
    default: "XArena — Play. Compete. Win.",
    template: "%s · XArena",
  },
  description: "India's premium esports tournament platform. Join Free Fire, BGMI, COD Mobile & Valorant tournaments, win real cash prizes, and climb the leaderboard.",
  manifest: "/manifest.json",
  applicationName: "XArena",
  appleWebApp: { capable: true, title: "XArena", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  keywords: ["esports", "tournaments", "Free Fire", "BGMI", "PUBG", "gaming", "cash prizes"],
  openGraph: {
    title: "XArena — Play. Compete. Win.",
    description: "India's premium esports tournament platform.",
    siteName: "XArena",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: PWA_EARLY_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
          <Toaster />
          <PwaProvider />
        </QueryProvider>
      </body>
    </html>
  );
}
