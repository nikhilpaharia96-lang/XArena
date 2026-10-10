import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
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
  referralCode: z.string().trim().toUpperCase().optional().or(z.literal("")),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
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

export const withdrawSchema = z.object({
  amountRupees: z.number().int().min(100, "Minimum withdrawal is ₹100"),
  upiId: z.string().trim().regex(/^[\w.-]+@[\w]+$/, "Enter a valid UPI ID"),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;
