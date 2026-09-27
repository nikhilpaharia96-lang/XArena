"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSignup } from "@/hooks/use-auth";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { motion } from "framer-motion";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
  referralCode: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { referralCode: searchParams.get("ref") ?? "" },
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Email</label>
          <Input type="email" placeholder="you@example.com" {...register("email")} error={errors.email?.message} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Username</label>
          <Input placeholder="ProGamerX" {...register("username")} error={errors.username?.message} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Password</label>
          <Input type="password" placeholder="••••••••" {...register("password")} error={errors.password?.message} />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Referral code (optional)</label>
          <Input placeholder="XA7K2P" {...register("referralCode")} error={errors.referralCode?.message} />
        </div>

        <Button type="submit" fullWidth size="lg" loading={signup.isPending}>
          Create Account
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
