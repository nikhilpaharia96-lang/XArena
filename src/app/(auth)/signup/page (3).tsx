"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSignup } from "@/hooks/use-auth";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { COUNTRY_CODES } from "@/lib/phone";
import { signupSchema } from "@/types/schemas";
import { motion } from "framer-motion";

type FormValues = z.input<typeof signupSchema>;

const label = "text-xs font-semibold text-white/60 mb-1.5 block";

function PasswordInput({
  show,
  onToggle,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { show: boolean; onToggle: () => void; error?: string }) {
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} error={error} className="pr-12" {...props} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-3 text-white/60 hover:text-white"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = useSignup();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { countryCode: "+91", referralCode: searchParams.get("ref") ?? "" },
  });

  const onSubmit = (values: FormValues) => {
    signup.mutate(values, {
      onSuccess: () => {
        toast({ title: "Account created!", description: "Welcome to XArena.", tone: "success" });
        router.push("/");
      },
      onError: (err) => {
        toast({
          title: "Signup failed",
          description: err instanceof ApiClientError ? err.message : "Please try again.",
          tone: "error",
        });
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl gradient-brand mx-auto flex items-center justify-center font-display font-black text-2xl text-white mb-4">
          X
        </div>
        <h1 className="text-2xl font-black text-white">Create your account</h1>
        <p className="text-white/50 text-sm mt-1">Join thousands of players competing daily</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className={label}>Email</label>
          <Input type="email" placeholder="you@example.com" {...register("email")} error={errors.email?.message} />
        </div>

        <div>
          <label className={label}>Phone no.</label>
          <div className="flex gap-2">
            <select
              aria-label="Country code"
              {...register("countryCode")}
              className="h-12 w-[116px] shrink-0 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white outline-none focus:border-violet/60 focus:ring-2 focus:ring-violet/20"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.iso} value={c.dial} className="bg-surface-2">
                  {c.label}
                </option>
              ))}
            </select>
            <Input type="tel" inputMode="numeric" placeholder="Phone no." {...register("phone")} error={errors.phone?.message} />
          </div>
          {errors.countryCode && <p className="mt-1.5 text-xs text-crimson">{errors.countryCode.message}</p>}
        </div>

        <div>
          <label className={label}>Username</label>
          <Input placeholder="Username" autoComplete="username" {...register("username")} error={errors.username?.message} />
        </div>

        <div>
          <label className={label}>Password</label>
          <PasswordInput
            show={showPw}
            onToggle={() => setShowPw((v) => !v)}
            placeholder="Password"
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
          />
        </div>

        <div>
          <label className={label}>Confirm Password</label>
          <PasswordInput
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            placeholder="Confirm Password"
            autoComplete="new-password"
            {...register("confirmPassword")}
            error={errors.confirmPassword?.message}
          />
        </div>

        <div>
          <label className={label}>Signup Code</label>
          <Input placeholder="Enter Signup Code" autoCapitalize="characters" {...register("signupCode")} error={errors.signupCode?.message} />
        </div>

        <div>
          <label className={label}>Referral code (optional)</label>
          <Input placeholder="XA7K2P" {...register("referralCode")} error={errors.referralCode?.message} />
        </div>

        <p className="text-xs leading-relaxed text-white/60">
          By clicking the &lsquo;Sign up&rsquo; button, you confirm that you have attained the age of majority in your country of
          residence and accept the Terms &amp; Conditions of XArena.
        </p>

        <Button type="submit" fullWidth size="lg" loading={signup.isPending}>
          SIGN UP
        </Button>
      </form>

      <p className="text-center text-sm text-white/50 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-violet font-semibold">
          Log in
        </Link>
      </p>
    </motion.div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
