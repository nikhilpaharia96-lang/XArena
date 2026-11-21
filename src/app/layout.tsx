import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "XArena — Play. Compete. Win.",
    template: "%s · XArena",
  },
  description: "Esports tournaments for Free Fire, BGMI, PUBG Mobile and more. Pay the entry fee, play your match, and get prize money in your wallet.",
  manifest: "/manifest.json",
  applicationName: "XArena",
  keywords: ["esports", "tournaments", "Free Fire", "BGMI", "PUBG", "gaming", "cash prizes"],
  openGraph: {
    title: "XArena — Play. Compete. Win.",
    description: "Esports tournaments with cash prizes.",
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
