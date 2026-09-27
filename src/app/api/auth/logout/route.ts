import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/server/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

    if (refreshToken) {
      db.prepare("UPDATE Session SET revokedAt = ? WHERE refreshToken = ?").run(
        new Date().toISOString(),
        refreshToken
      );
    }

    cookieStore.delete(ACCESS_COOKIE_NAME);
    cookieStore.delete(REFRESH_COOKIE_NAME);

    return ok({ loggedOut: true });
  } catch (error) {
    return fail(error);
  }
}
