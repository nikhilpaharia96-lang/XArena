import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-crimson/10 border border-crimson/20 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-crimson" />
      </div>
      <p className="text-white font-semibold">Something went wrong</p>
      <p className="text-white/50 text-sm mt-1 max-w-xs">{message ?? "Please try again in a moment."}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
