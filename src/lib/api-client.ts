/**
 * Thin typed wrapper around fetch for talking to our own /api routes.
 * Always sends credentials (httpOnly cookies) and unwraps the
 * { success, data } / { success, error, code } envelope every route
 * returns, throwing ApiClientError on failure so React Query's error
 * state "just works" without every call site repeating this logic.
 */

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // CSV/report endpoints return a raw file, not the JSON envelope.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new ApiClientError(res.status, "Request failed.");
    return res as unknown as T;
  }

  const body: Envelope<T> = await res.json();
  if (!body.success) {
    throw new ApiClientError(res.status, body.error ?? "Something went wrong.", body.code);
  }
  return body.data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
};
