"use client";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { SiteFooter } from "./site-footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopBar />
      <main id="main-content" tabIndex={-1} className="flex-1 mx-auto w-full max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-12 pt-4 sm:pt-6 outline-none">{children}
        <SiteFooter />
      </main>
      <BottomNav />
    </div>
  );
}
