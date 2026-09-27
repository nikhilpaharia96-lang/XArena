"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this should report to an error-tracking service
    // (Sentry, etc.) once configured — logging is intentionally silent here.
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-void">
      <div className="h-16 w-16 rounded-2xl bg-crimson/10 border border-crimson/20 flex items-center justify-center mb-5">
        <AlertTriangle className="h-8 w-8 text-crimson" />
      </div>
      <h1 className="text-2xl font-black text-white">Something went wrong</h1>
      <p className="text-white/50 text-sm mt-2 max-w-xs">An unexpected error occurred. Please try again.</p>
      <Button className="mt-6" onClick={reset}>Try Again</Button>
    </div>
  );
}
