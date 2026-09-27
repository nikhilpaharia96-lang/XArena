"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-auth";

export function useRequireAdmin() {
  const query = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (query.data === null) {
      router.replace("/login");
    } else if (query.data && !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(query.data.user.role)) {
      router.replace("/");
    }
  }, [query.data, router]);

  return query;
}
