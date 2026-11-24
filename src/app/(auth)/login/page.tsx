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

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => {
    login.mutate(values, {
      onSuccess: () => {
        toast({ title: "Welcome back!", tone: "success" });
        router.push("/");
      },
      onError: (err) => {
        toast({
          title: "Login failed",
          description: err instanceof ApiClientError ? err.message : "Please try again.",
          tone: "error",
        });
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-black text-white">Welcome back</h1>
        <p className="text-white/55 text-sm mt-1">Log in to join tournaments and manage your wallet.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Email or Phone no.</label>
          <Input
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="you@example.com or 9876543210"
            {...register("identifier")}
            error={errors.identifier?.message}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Password</label>
          <PasswordInput autoComplete="current-password" placeholder="Enter your password" {...register("password")} error={errors.password?.message} />
        </div>

        <Button type="submit" fullWidth size="lg" loading={login.isPending}>
          Log In
        </Button>
      </form>

      <p className="text-center text-sm text-white/55 mt-5">
        New to XArena?{" "}
        <Link href="/signup" className="text-violet font-semibold">
          Create an account
        </Link>
      </p>
    </motion.div>
  );
}
