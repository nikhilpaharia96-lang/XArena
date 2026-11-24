"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, LifeBuoy, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForgotPassword } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api-client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/types/schemas";

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [mode, setMode] = useState<"email" | "support" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  function onSubmit(values: ForgotPasswordInput) {
    setError(null);
    forgot.mutate(values, {
      onSuccess: (res) => setMode(res.mode),
      onError: (e) => setError(e instanceof ApiClientError ? e.message : "Something went wrong. Please try again."),
    });
  }

  if (mode) {
    const email = mode === "email";
    return (
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-signal/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-signal" />
        </div>
        <h1 className="text-xl font-black text-white">{email ? "Check your email" : "Request received"}</h1>
        <p className="text-sm text-white/65 mt-2 leading-relaxed">
          {email
            ? "If an account exists for what you entered, we've sent a link to reset your password. It works for 30 minutes and can be used once."
            : "If an account exists for what you entered, our team has been notified and will help you reset your password. We'll share a temporary password with you privately after checking it's you."}
        </p>
        {email && <p className="text-xs text-white/45 mt-3">Can&apos;t find it? Check your spam folder.</p>}
        <Link href="/login" className="mt-6 block">
          <Button fullWidth>Back to Login</Button>
        </Link>
        <Link href="/support" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cobalt py-2">
          <LifeBuoy className="h-3.5 w-3.5" /> Need help? Contact Support
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white mb-4 py-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
      </Link>
      <div className="text-center mb-6">
        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
          <Mail className="h-6 w-6 text-cobalt" />
        </div>
        <h1 className="text-2xl font-black text-white">Forgot password?</h1>
        <p className="text-white/55 text-sm mt-1">Enter your email or phone number and we&apos;ll help you get back in.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Email or Phone Number</label>
          <Input
            autoComplete="username"
            autoCapitalize="none"
            placeholder="you@example.com or 9876543210"
            {...register("identifier")}
            error={errors.identifier?.message}
          />
        </div>
        {error && <p role="alert" className="text-sm text-crimson">{error}</p>}
        <Button type="submit" fullWidth size="lg" loading={forgot.isPending}>
          CONTINUE
        </Button>
      </form>
    </div>
  );
}
