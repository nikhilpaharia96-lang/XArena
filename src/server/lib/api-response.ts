import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ success: true, data }, { status: init ?? 200 });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  console.error("[API] Unhandled error:", error);
  return NextResponse.json(
    { success: false, error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

/** Turns a ZodError into a 400 ApiError whose message names the first failing field. */
export function validationError(error: unknown): ApiError | null {
  if (!(error instanceof Error) || error.name !== "ZodError") return null;
  const issues = (error as unknown as { issues?: { path: (string | number)[]; message: string }[] }).issues ?? [];
  const first = issues[0];
  if (!first) return new ApiError(400, "Invalid input.", "VALIDATION_ERROR");
  const field = first.path.length ? String(first.path[0]) : "";
  // Custom messages already read as full sentences; only prefix generic zod ones.
  const msg = /^(Too small|Too big|Invalid|Required)/.test(first.message) && field ? `${field}: ${first.message}` : first.message;
  return new ApiError(400, msg, "VALIDATION_ERROR");
}
