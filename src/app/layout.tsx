import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "XArena — Play. Compete. Win.",
    template: "%s · XArena",
  },
  description: "India's premium esports tournament platform. Join Free Fire, BGMI, COD Mobile & Valorant tournaments, win real cash prizes, and climb the leaderboard.",
  manifest: "/manifest.json",
  applicationName: "XArena",
  keywords: ["esports", "tournaments", "Free Fire", "BGMI", "PUBG", "gaming", "cash prizes"],
  openGraph: {
    title: "XArena — Play. Compete. Win.",
    description: "India's premium esports tournament platform.",
    siteName: "XArena",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
