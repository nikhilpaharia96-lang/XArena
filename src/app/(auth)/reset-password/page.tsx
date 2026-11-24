"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useResetPassword } from "@/hooks/use-auth";
import { api, ApiClientError } from "@/lib/api-client";
import { resetPasswordSchema, type ResetPasswordInput } from "@/types/schemas";

type Check = "checking" | "valid" | "invalid";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const reset = useResetPassword();
  const [check, setCheck] = useState<Check>(token ? "checking" : "invalid");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token } });

  useEffect(() => {
    if (!token) return;
    let live = true;
    api
      .get<{ valid: boolean }>(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => live && setCheck(r.valid ? "valid" : "invalid"))
      .catch(() => live && setCheck("invalid"));
    return () => {
      live = false;
    };
  }, [token]);

  function onSubmit(values: ResetPasswordInput) {
    setError(null);
    reset.mutate(values, {
      onSuccess: () => setDone(true),
      onError: (e) => setError(e instanceof ApiClientError ? e.message : "Something went wrong. Please try again."),
    });
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-signal/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-signal" />
        </div>
        <h1 className="text-xl font-black text-white">Password updated</h1>
        <p className="text-sm text-white/65 mt-2">Log in with your new password. Other devices that were signed in will be signed out within a few minutes.</p>
        <Link href="/login" className="mt-6 block">
          <Button fullWidth>Go to Login</Button>
        </Link>
      </div>
    );
  }

  if (check === "checking") return <p className="text-center text-sm text-white/60 py-6">Checking your link…</p>;

  if (check === "invalid") {
    return (
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-crimson/15 flex items-center justify-center mx-auto mb-4">
          <XCircle className="h-7 w-7 text-crimson" />
        </div>
        <h1 className="text-xl font-black text-white">Link expired or invalid</h1>
        <p className="text-sm text-white/65 mt-2">Reset links work for 30 minutes and only once. Request a new one to continue.</p>
        <Link href="/forgot-password" className="mt-6 block">
          <Button fullWidth>Request a New Link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
          <KeyRound className="h-6 w-6 text-cobalt" />
        </div>
        <h1 className="text-2xl font-black text-white">Set a new password</h1>
        <p className="text-white/55 text-sm mt-1">At least 8 characters, with a capital letter and a number.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <input type="hidden" {...register("token")} />
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">New Password</label>
          <PasswordInput autoComplete="new-password" placeholder="Enter new password" {...register("password")} error={errors.password?.message} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Confirm Password</label>
          <PasswordInput autoComplete="new-password" placeholder="Re-enter new password" {...register("confirmPassword")} error={errors.confirmPassword?.message} />
        </div>
        {error && <p role="alert" className="text-sm text-crimson">{error}</p>}
        <Button type="submit" fullWidth size="lg" loading={reset.isPending}>
          UPDATE PASSWORD
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-white/60 py-6">Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
