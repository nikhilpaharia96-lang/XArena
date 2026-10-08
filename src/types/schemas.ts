import { z } from "zod";
import { DIAL_CODES, validatePhone } from "@/lib/phone";

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    countryCode: z.enum(DIAL_CODES, { message: "Select a country code" }),
    phone: z.string().trim().regex(/^\d+$/, "Digits only"),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    signupCode: z.string().trim().min(1, "Signup code is required"),
    referralCode: z.string().trim().toUpperCase().optional().or(z.literal("")),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .superRefine((v, ctx) => {
    const err = validatePhone(v.countryCode, v.phone);
    if (err) ctx.addIssue({ code: "custom", path: ["phone"], message: err });
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  /** Email address or phone number (e.g. 9876543210 or +919876543210). */
  identifier: z.string().trim().min(1, "Enter your email or phone number").max(254),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const joinTournamentSchema = z.object({
  teamName: z.string().trim().max(40).optional(),
});
export type JoinTournamentInput = z.infer<typeof joinTournamentSchema>;

export const submitResultSchema = z.object({
  matchId: z.string().min(1),
  placement: z.number().int().min(1).max(100).optional(),
  kills: z.number().int().min(0).max(60),
  screenshotUrl: z.string().url().optional(),
});
export type SubmitResultInput = z.infer<typeof submitResultSchema>;

export const depositSchema = z.object({
  amountRupees: z
    .number()
    .int("Amount must be a whole number")
    .min(10, "Minimum deposit is ₹10")
    .max(100000, "Maximum deposit is ₹1,00,000 per transaction"),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawSchema = z.object({
  amountRupees: z.number().int().min(100, "Minimum withdrawal is ₹100"),
  upiId: z.string().trim().regex(/^[\w.-]+@[\w]+$/, "Enter a valid UPI ID"),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;
