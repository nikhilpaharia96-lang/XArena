import Link from "next/link";
import { Ghost } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-void">
      <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
        <Ghost className="h-8 w-8 text-white/40" />
      </div>
      <h1 className="text-2xl font-black text-white">Page not found</h1>
      <p className="text-white/50 text-sm mt-2 max-w-xs">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Link href="/" className="mt-6 gradient-brand rounded-2xl px-6 h-12 flex items-center text-sm font-semibold text-white">
        Back to Home
      </Link>
    </div>
  );
}
