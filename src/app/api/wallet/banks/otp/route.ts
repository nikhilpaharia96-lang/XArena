import { fail, ok, ApiError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { issueBankOtp } from "@/server/lib/bank-otp";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { allowed } = checkRateLimit(`bank-otp:${getClientKey(req)}:${user.id}`, 5, 10 * 60_000);
    if (!allowed) throw new ApiError(429, "Too many OTP requests. Please try again in a few minutes.");
    return ok(issueBankOtp(user.id));
  } catch (error) {
    return fail(error);
  }
}
