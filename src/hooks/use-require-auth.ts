"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-auth";

/** Redirects to /login if the session query resolves to null. Returns the
 * query result so pages can also show a loading skeleton while it's pending. */
export function useRequireAuth() {
  const query = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (query.data === null) {
      router.replace("/login");
    }
  }, [query.data, router]);

  return query;
}
