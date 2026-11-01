import { ApiError, fail, validationError } from "@/server/lib/api-response";
import { GameError } from "./errors";

/** Maps game-domain errors to the app's standard JSON error envelope. */
export function failGame(error: unknown) {
  if (error instanceof GameError) return fail(new ApiError(error.status, error.message, error.code));
  const v = validationError(error);
  if (v) return fail(v);
  return fail(error);
}
