"use client";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-10 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
