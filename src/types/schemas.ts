import { z } from "zod";
import { DIAL_CODES, validatePhone } from "@/lib/phone";

/** Single source of truth for password strength (signup + reset). */
export const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

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
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your password"),
    /** Signup code = another player's referral code. Optional; a wrong code is rejected. */
    signupCode: z.string().trim().toUpperCase().optional().or(z.literal("")),
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
  // Slot/position the player picked (omitted when the tournament auto-assigns slots).
  slotNumber: z.number().int().min(1).optional(),
  position: z.number().int().min(1).max(16).optional(),
  ign: z.string().trim().min(2, "Enter your in-game name (at least 2 characters)").max(40, "In-game name must be 40 characters or fewer"),
  gameUid: z.string().trim().min(3, "Enter your Game UID").max(40, "Game UID is too long"),
  acceptRules: z.boolean().refine((v) => v === true, "You must accept the tournament rules to join."),
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

export const withdrawSchema = z
  .object({
    amountRupees: z.number().int().min(100, "Minimum withdrawal is ₹100"),
    /** Preferred: one of the user's saved bank accounts. */
    bankId: z.string().trim().min(1).max(64).optional(),
    /** Legacy UPI payout, still accepted by the API. */
    upiId: z.string().trim().regex(/^[\w.-]+@[\w]+$/, "Enter a valid UPI ID").optional(),
  })
  .refine((d) => d.bankId || d.upiId, { message: "Choose a bank account to withdraw into", path: ["bankId"] });

export const addBankSchema = z.object({
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code (e.g. SBIN0001234)"),
  bankName: z.string().trim().min(2, "Select your bank").max(60),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Account number must be 9–18 digits"),
  accountHolder: z
    .string()
    .trim()
    .min(2, "Enter the account holder name")
    .max(80)
    .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters only, exactly as on the bank account"),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});
export type AddBankInput = z.infer<typeof addBankSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone number").max(254),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "This reset link is invalid.").max(200),
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
