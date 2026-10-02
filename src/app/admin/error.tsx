"use client";

import { ErrorState } from "@/components/ui/error-state";

// Admin-only boundary: unlike the public error page, it shows the real message
// so a broken admin screen can be diagnosed without opening the console.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message={error.message || "An unexpected error occurred."} onRetry={reset} />;
}
