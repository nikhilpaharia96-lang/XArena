import { cn } from "@/lib/cn";
import type { PublicUser } from "@/hooks/use-friends";

export function UserAvatar({ user, size = 44, className }: { user: Pick<PublicUser, "username" | "avatarUrl">; size?: number; className?: string }) {
  const style = { width: size, height: size };
  return (
    <div
      style={style}
      className={cn("rounded-full overflow-hidden shrink-0 gradient-brand flex items-center justify-center text-white font-bold", className)}
      aria-hidden
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>{user.username.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export const displayNameOf = (u: Pick<PublicUser, "username" | "displayName">) => u.displayName?.trim() || u.username;
