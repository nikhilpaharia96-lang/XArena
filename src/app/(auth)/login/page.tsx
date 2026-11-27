"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useLogin } from "@/hooks/use-auth";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AlertCircle, Lock, User } from "lucide-react";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't set up yet. Please log in with email or phone.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Couldn't sign in with Google. Please try again.",
  account_banned: "This account has been banned. Contact support if you think this is a mistake.",
  account_suspended: "This account is temporarily suspended.",
  too_many: "Too many attempts. Try again in a minute.",
};

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

/** Where to go after login: only same-site paths (blocks open-redirects like //evil.com). */
function safeNext(raw: string | null): string {
  return raw && /^\/(?!\/)[^\\]*$/.test(raw) ? raw : "/";
}

export default function LoginPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Google sends people back here with ?error=... when sign-in doesn't work out.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && GOOGLE_ERRORS[code]) toast({ title: "Google sign-in", description: GOOGLE_ERRORS[code], tone: "error" });
  }, []);

  const onSubmit = (values: FormValues) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => {
        toast({ title: "Welcome back!", tone: "success" });
        router.push(safeNext(new URLSearchParams(window.location.search).get("next")));
      },
      onError: (err) => {
        setFormError(err instanceof ApiClientError ? err.message : "Please try again.");
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-5">
        <h1 className="text-[26px] leading-tight font-black text-white">Welcome back, <span className="text-gradient-brand">player</span></h1>
        <p className="text-white/60 text-sm mt-1.5">Log in to join tournaments, win prizes and withdraw instantly.</p>
      </div>

      <GoogleButton />
      <OrDivider />

      {formError && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 px-3 py-2.5 text-sm text-crimson">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="identifier" className="text-xs font-semibold text-white/70 mb-1.5 block">Email or phone number</label>
          <Input
            id="identifier"
            leading={<User />}
            enterKeyHint="next"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Email or 10-digit phone"
            {...register("identifier")}
            error={errors.identifier?.message}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-white/70">Password</label>
            <Link href="/forgot-password" className="text-xs font-bold text-cobalt hover:underline py-3 -my-3 pl-3">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" leading={<Lock />} enterKeyHint="go" autoComplete="current-password" placeholder="Enter your password" {...register("password")} error={errors.password?.message} />
        </div>

        <Button type="submit" fullWidth size="lg" loading={login.isPending}>
          Log In
        </Button>
      </form>

      <div className="mt-5 rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 text-center">
        <p className="text-sm text-white/60">New to XArena?</p>
        <Link href="/signup" className="mt-2 flex h-11 items-center justify-center rounded-xl border border-violet/50 text-sm font-bold text-cobalt hover:bg-violet/10 active:bg-violet/15 transition-colors">
          Create free account
        </Link>
      </div>
    </motion.div>
  );
}
